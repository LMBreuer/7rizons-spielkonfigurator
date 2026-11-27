import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("database migration enforces private drafts, admin roles, explicit submissions, revisions and quotas", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001",
    other = "00000000-0000-4000-8000-000000000002",
    admin = "00000000-0000-4000-8000-000000000003",
    config = "00000000-0000-4000-8000-000000000010";
  try {
    await db.exec(
      `create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz); create role anon; create role authenticated; create role service_role bypassrls; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role; alter default privileges in schema public grant all on tables to anon,authenticated,service_role; alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`,
    );
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(migrations))
      .filter((x) => x.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, migrations), "utf8"));
    await db.query("insert into auth.users values($1),($2),($3)", [
      owner,
      other,
      admin,
    ]);
    await db.query("insert into public.admins values($1)", [admin]);
    await db.query("insert into public.superadmins values($1)", [admin]);
    await db.query(
      "update auth.users set email = case when id = $1 then 'owner@example.test' else 'moderator@example.test' end, email_confirmed_at = now() where id in ($1,$2)",
      [owner, other],
    );
    const identity = async (id, role = "authenticated") => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role " + role);
    };
    await identity("", "anon");
    await assert.rejects(
      () => db.query("select public.my_workshops()"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select * from public.app_settings")).rows.length,
      1,
    );
    await assert.rejects(
      () => db.query("select * from public.scoped_provider_credentials"),
      /permission denied/,
    );
    await identity("", "service_role");
    await db.query(
      `insert into public.scoped_provider_credentials (provider, owner_id, ciphertext, iv)
        values ('openai', $1, 'test-ciphertext', 'test-iv'), ('openai', $2, 'another-ciphertext', 'test-iv')`,
      [owner, other],
    );
    await db.query(
      `insert into public.scoped_provider_credentials (provider, owner_id, ciphertext, iv)
        values ('openai', $1, 'updated-ciphertext', 'test-iv')
        on conflict (provider, owner_id, workshop_id) do update set ciphertext = excluded.ciphertext`,
      [owner],
    );
    assert.equal(
      (
        await db.query(
          "select ciphertext from public.scoped_provider_credentials where owner_id = $1",
          [owner],
        )
      ).rows[0].ciphertext,
      "updated-ciphertext",
    );
    await identity(owner);
    await assert.rejects(
      () => db.query("select * from public.scoped_provider_credentials"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select public.is_admin() as value")).rows[0].value,
      false,
    );
    await assert.rejects(() =>
      db.query("insert into public.admins values($1)", [owner]),
    );
    const publish = async (revision) =>
      db.query(
        "update public.app_settings set content=$1, content_revision=gen_random_uuid() where id and content_revision=$2 returning content_revision",
        [{ blocks: { closing: "Test" } }, revision],
      );
    const edition = (
      await db.query("select content_revision from public.app_settings")
    ).rows[0].content_revision;
    assert.equal((await publish(edition)).rows.length, 0);
    await identity(admin);
    assert.equal((await publish(edition)).rows.length, 1);
    assert.equal((await publish(edition)).rows.length, 0);
    await identity(owner);
    const save = async (rev) =>
      (
        await db.query(
          "select public.save_configuration($1,$2,$3,$4::jsonb) as revision",
          [
            config,
            rev,
            "Mein Entwurf",
            JSON.stringify({
              draft: {},
              result: { title: "Ergebnis" },
              worksheets: [{ private: "x".repeat(210000) }],
              pendingRequest: { private: "PRIVATE" },
            }),
          ],
        )
      ).rows[0].revision;
    assert.equal(await save(0), 1);
    assert.equal(await save(1), 2);
    await assert.rejects(() => save(1), /Online-Stand/);
    await identity(other);
    assert.equal(
      (await db.query("select * from public.configurations")).rows.length,
      0,
    );
    await assert.rejects(() => save(2), /Kein Zugriff/);
    await identity(admin);
    assert.equal(
      (await db.query("select * from public.configurations")).rows.length,
      0,
    );
    const w = (
      await db.query(
        "insert into public.workshops(title,join_code,central_ai,generation_limit) values('Workshop','0123456789abcdef0123456789abcdef',true,2) returning id",
      )
    ).rows[0].id;
    await identity(owner);
    assert.equal(
      (await db.query("select * from public.workshops")).rows.length,
      0,
    );
    await assert.rejects(
      () => db.query("select public.submit_configuration($1,$2)", [w, config]),
      /Mitgliedschaft/,
    );
    await assert.rejects(
      () => db.query("select public.join_workshop('wrong')"),
      /ungültig/,
    );
    await db.query(
      "select public.join_workshop('0123456789abcdef0123456789abcdef')",
    );
    assert.equal(
      (await db.query("select * from public.my_workshops()")).rows.length,
      1,
    );
    const submission = (
      await db.query("select public.submit_configuration($1,$2) as id", [
        w,
        config,
      ])
    ).rows[0].id;
    await assert.rejects(
      () => db.query("select public.review_submission($1)", [submission]),
      /Administration/,
    );
    await assert.rejects(
      () => db.query("select public.reserve_generation($1,$2,10)", [owner, w]),
      /permission denied/,
    );
    await identity(other);
    assert.equal(
      (await db.query("select * from public.submissions")).rows.length,
      0,
    );
    await identity(admin);
    assert.equal(
      (await db.query("select * from public.submissions")).rows.length,
      1,
    );
    const shared = (
      await db.query("select payload from public.submissions where id=$1", [
        submission,
      ])
    ).rows[0].payload;
    assert.equal(shared.result.title, "Ergebnis");
    assert.equal(shared.worksheets, undefined);
    assert.equal(shared.pendingRequest, undefined);
    await db.query("select public.review_submission($1)", [submission]);
    await assert.rejects(
      () =>
        db.query(
          "insert into public.provider_credentials(provider,ciphertext,iv) values('openai','encrypted','iv')",
        ),
      /row-level security/,
    );
    const visible = (
      await db.query("select * from public.superadmin_projects()")
    ).rows[0];
    assert.equal(visible.title, "Mein Entwurf");
    assert.equal(visible.payload, undefined);
    assert.equal(
      (
        await db.query(
          "select public.request_project_access($1) as recipient",
          [config],
        )
      ).rows[0].recipient,
      "owner@example.test",
    );
    const request = (
      await db.query("select * from public.superadmin_projects()")
    ).rows[0];
    await assert.rejects(
      () =>
        db.query("select public.read_approved_project($1)", [
          request.request_id,
        ]),
      /nicht freigegeben/,
    );
    await db.query(
      "select public.set_workshop_moderator($1,'moderator@example.test',true)",
      [w],
    );
    await identity(other);
    await assert.rejects(
      () => db.query("select public.superadmin_projects()"),
      /Superadministration/,
    );
    await assert.rejects(
      () =>
        db.query("select public.answer_project_access($1,'approved',2)", [
          request.request_id,
        ]),
      /Freigabeanfrage/,
    );
    await assert.rejects(
      () =>
        db.query("select public.set_workshop_project($1,$2,true)", [w, config]),
      /eigene Online-Projekte/,
    );
    await identity(owner);
    await db.query("select public.set_workshop_project($1,$2,true)", [
      w,
      config,
    ]);
    await assert.rejects(
      () =>
        db.query("select public.answer_project_access($1,'approved',1)", [
          request.request_id,
        ]),
      /geändert/,
    );
    await db.query("select public.answer_project_access($1,'approved',2)", [
      request.request_id,
    ]);
    const token = (
      await db.query("select public.create_project_share($1,2) as token", [
        config,
      ])
    ).rows[0].token;
    await identity("", "anon");
    assert.equal(
      (await db.query("select public.read_project_share($1) as value", [token]))
        .rows[0].value.title,
      "Mein Entwurf",
    );
    await assert.rejects(
      () => db.query("select * from public.project_share_links"),
      /permission denied/,
    );
    await identity(other);
    assert.equal(
      (await db.query("select * from public.my_moderated_workshops()")).rows[0]
        .id,
      w,
    );
    assert.equal(
      (await db.query("select * from public.list_workshop_projects($1)", [w]))
        .rows[0].id,
      config,
    );
    const unrelated = (await db.query("select gen_random_uuid() as id")).rows[0]
      .id;
    await assert.rejects(
      () =>
        db.query("select * from public.list_workshop_projects($1)", [
          unrelated,
        ]),
      /Moderation dieses/,
    );
    assert.equal(
      (await db.query("select * from public.submissions")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.configurations")).rows.length,
      0,
    );
    await identity(admin);
    assert.equal(
      (
        await db.query("select public.read_approved_project($1) as value", [
          request.request_id,
        ])
      ).rows[0].value.result.title,
      "Ergebnis",
    );
    await identity(owner);
    await db.query("select public.answer_project_access($1,'revoked',2)", [
      request.request_id,
    ]);
    await db.query("select public.revoke_project_share($1)", [config]);
    await identity(admin);
    await assert.rejects(
      () =>
        db.query("select public.read_approved_project($1)", [
          request.request_id,
        ]),
      /nicht freigegeben/,
    );
    assert.equal(
      (await db.query("select public.read_project_share($1) as value", [token]))
        .rows[0].value,
      null,
    );
    await identity(owner, "service_role");
    await db.query("select public.reserve_generation($1,$2,10)", [owner, w]);
    await db.query("select public.reserve_generation($1,$2,10)", [owner, w]);
    await assert.rejects(
      () => db.query("select public.reserve_generation($1,$2,10)", [owner, w]),
      /Generierungslimit/,
    );
    await assert.rejects(
      () => db.query("select public.reserve_generation($1,null,2)", [owner]),
      /Stundenlimit/,
    );
    await identity(owner);
    await db.query("delete from public.submissions where id=$1", [submission]);
    assert.equal(
      (await db.query("select * from public.submissions")).rows.length,
      0,
    );
    // A workshop can pin its own edition while another follows the public default.
    const sql = async (query, args = []) => (await db.query(query, args)).rows;
    const first = async (query, args) => (await sql(query, args))[0];
    await identity(admin);
    const base = await first("select * from public.content_editions");
    const { id: copy } = await first(
      "select public.copy_content_edition($1,$2,'Seminar') id",
      [base.id, base.revision],
    );
    const { revision } = await first(
      "select revision from public.content_editions where id=$1",
      [copy],
    );
    const content = { blocks: { closing: "Seminar B" } };
    await sql("select public.publish_content_edition($1,$2,'Seminar B',$3)", [
      copy,
      revision,
      content,
    ]);
    await assert.rejects(
      () =>
        sql("select public.publish_content_edition($1,$2,'Alt',$3)", [
          copy,
          revision,
          {},
        ]),
      /inzwischen geändert/,
    );
    await sql("update public.workshops set edition_id=$1 where id=$2", [
      copy,
      w,
    ]);
    const { id: follows } = await first(
      "insert into public.workshops(title,join_code) values('Standard','abcdefghijklmnop') returning id",
    );
    await sql("select public.set_roster_role($1,'owner@example.test','add')", [
      follows,
    ]);
    await identity("", "anon");
    assert.deepEqual(await sql("select id from public.content_editions"), [
      { id: base.id },
    ]);
    await assert.rejects(
      () => sql("select public.workshop_edition($1)", [w]),
      /permission denied/,
    );
    await assert.rejects(
      () => sql("select public.choose_default_edition($1)", [copy]),
      /permission denied/,
    );
    await identity(other);
    await assert.rejects(
      () => sql("select public.workshop_edition($1)", [follows]),
      /Keine aktive Workshop-Mitgliedschaft/,
    );
    await identity(owner);
    assert.deepEqual(
      (await first("select public.workshop_edition($1) edition", [w])).edition,
      { id: copy, title: "Seminar B", content },
    );
    assert.deepEqual(
      (await first("select public.workshop_content($1) content", [w])).content,
      content,
    );
    assert.deepEqual(
      (await first("select public.workshop_content($1) content", [follows]))
        .content,
      base.content,
    );
    assert.deepEqual(await sql("select id from public.content_editions"), [
      { id: base.id },
    ]);
    for (const [query, args] of [
      ["select public.account_directory('',0)", []],
      ["select public.set_account_admin($1,true)", [owner]],
      ["select public.workshop_roster($1)", [w]],
      ["select public.choose_default_edition($1)", [copy]],
      ["select public.set_edition_visibility($1,true)", [copy]],
      [
        "select public.copy_content_edition($1,$2,'Other')",
        [base.id, base.revision],
      ],
      [
        "select public.set_roster_role($1,'owner@example.test','moderator')",
        [w],
      ],
    ])
      await assert.rejects(() => sql(query, args), /Nur /);
    await identity(admin);
    await assert.rejects(
      () => sql("update public.app_settings set default_edition_id=$1", [copy]),
      /permission denied/,
    );
    await sql("select public.set_edition_visibility($1,true)", [copy]);
    await identity("", "anon");
    assert.deepEqual(
      await first("select title,content from public.content_editions where id=$1", [copy]),
      { title: "Seminar B", content },
    );
    await identity(admin);
    await sql("select public.set_edition_visibility($1,false)", [copy]);
    await sql("select public.choose_default_edition($1)", [copy]);
    await assert.rejects(
      () => sql("select public.set_edition_visibility($1,false)", [copy]),
      /Standardfassung muss öffentlich sein/,
    );
    await identity("", "anon");
    assert.deepEqual(await first("select id from public.content_editions where id=$1", [copy]), { id: copy });
    assert.deepEqual(
      (await first("select content from public.app_settings")).content,
      content,
    );

    await identity(owner);
    assert.deepEqual(
      (await first("select public.workshop_content($1) content", [follows]))
        .content,
      content,
    );
    await identity(admin);
    await sql(
      "select public.set_roster_role($1,'moderator@example.test','moderator')",
      [w],
    );
    await sql(
      "select public.set_roster_role($1,'moderator@example.test','add')",
      [w],
    );
    await identity(other);
    assert.equal(
      (await sql("select * from public.workshop_roster($1)", [w])).some(
        (r) => r.moderator && r.email === "moderator@example.test",
      ),
      true,
    );
    await assert.rejects(
      () => sql("select public.workshop_roster($1)", [follows]),
      /Moderation/,
    );
    await identity(admin);
    await sql(
      "select public.set_roster_role($1,'moderator@example.test','remove')",
      [w],
    );
    await sql("select public.set_account_admin($1,true)", [other]);
    assert.equal(
      (await first("select * from public.account_directory('moderator',0)"))
        .account_role,
      "admin",
    );
    await identity(other);
    assert.equal((await first("select public.is_admin() yes")).yes, true);
    await assert.rejects(
      () => sql("select public.set_account_admin($1,true)", [owner]),
      /Superadministration/,
    );
    await identity(admin);
    await sql("select public.set_account_admin($1,false)", [other]);
    await identity(other);
    await assert.rejects(
      () => sql("select public.workshop_content($1)", [w]),
      /Mitgliedschaft/,
    );
    await assert.rejects(
      () => sql("select public.workshop_roster($1)", [w]),
      /Moderation/,
    );
    await identity("", "anon");
    await assert.rejects(
      () => sql("select public.account_directory('',0)"),
      /permission denied/,
    );
    assert.deepEqual(
      (await first("select content from public.app_settings")).content,
      content,
    );
    const managed = "00000000-0000-4000-8000-000000000011";
    const saveManaged =
      "select public.save_configuration_for_administration($1,$2,$3,$4) revision";
    const readManaged = "select public.read_admin_project($1) project";
    const assign = "select public.admin_set_workshop_project($1,$2,$3)";
    const snapshot = {
      draft: { id: managed },
      worksheets: [{ title: "Example" }],
    };
    await assert.rejects(
      () => sql(saveManaged, [managed, 0, "Workshop project", snapshot]),
      /permission denied/,
    );
    await assert.rejects(
      () => sql("select * from public.admin_projects()"),
      /permission denied/,
    );
    await identity(owner);
    assert.equal(
      (
        await first(
          "select admin_shared_at from public.configurations where id=$1",
          [config],
        )
      ).admin_shared_at,
      null,
    );
    assert.equal(
      (await first(saveManaged, [managed, 0, "Workshop project", snapshot]))
        .revision,
      1,
    );
    await assert.rejects(
      () => sql(saveManaged, [managed, 0, "Stale", {}]),
      /Online-Stand wurde geändert/,
    );
    await identity(admin);
    await sql("select public.set_account_admin($1,true)", [other]);
    const { id: externalWorkshop } = await first(
      "insert into public.workshops(title,join_code) values('Project check','qrstuvwxyzabcdef') returning id",
    );
    await sql(
      "select public.set_roster_role($1,'moderator@example.test','moderator')",
      [externalWorkshop],
    );
    await identity(other);
    assert.deepEqual(
      await sql("select id,admin_access from public.admin_projects()"),
      [{ id: managed, admin_access: true }],
    );
    assert.deepEqual((await first(readManaged, [managed])).project, snapshot);
    await assert.rejects(
      () => sql(readManaged, [config]),
      /Projektinhalt nicht freigegeben/,
    );
    await assert.rejects(
      () => sql(assign, [config, externalWorkshop, true]),
      /Projektinhalt nicht freigegeben/,
    );
    assert.deepEqual(await sql("select id from public.configurations"), []);
    await sql(assign, [managed, externalWorkshop, true]);
    await sql(assign, [managed, externalWorkshop, true]);
    assert.deepEqual(
      (
        await first(
          "select workshop_ids from public.admin_projects() where id=$1",
          [managed],
        )
      ).workshop_ids,
      [externalWorkshop],
    );
    await identity(owner);
    assert.deepEqual(
      await sql(
        "select workshop_id from public.my_workshop_project_links($1)",
        [managed],
      ),
      [{ workshop_id: externalWorkshop }],
    );
    assert.equal(
      (await sql("select * from public.my_workshops()")).some(
        ({ id }) => id === externalWorkshop,
      ),
      false,
    );
    await identity(admin);
    await sql("select public.set_account_admin($1,false)", [other]);
    await identity(other);
    const managedRow = await first(
      "select * from public.list_workshop_projects($1)",
      [externalWorkshop],
    );
    assert.equal(managedRow.id, managed);
    assert.equal(managedRow.payload, undefined);
    await assert.rejects(
      () => sql("select * from public.admin_projects()"),
      /Nur Administration/,
    );
    await assert.rejects(
      () => sql(readManaged, [managed]),
      /Nur Administration/,
    );
    await assert.rejects(
      () => sql(assign, [managed, externalWorkshop, false]),
      /Nur Administration/,
    );
    await identity(admin);
    await sql(assign, [managed, externalWorkshop, false]);
    assert.deepEqual(
      await sql("select * from public.list_workshop_projects($1)", [
        externalWorkshop,
      ]),
      [],
    );
  } finally {
    await db.close();
  }
});
