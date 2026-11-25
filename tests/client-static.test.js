const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const client = path.join(__dirname, "..", "client");
const read = (file) => fs.readFileSync(path.join(client, file), "utf8");

test("mọi trang HTML tham chiếu tới file HTML/CSS/JS có thật", () => {
  const pages = ["index.html", ...fs.readdirSync(path.join(client, "pages")).map((f) => "pages/" + f)];
  for (const page of pages) {
    const dir = path.dirname(path.join(client, page));
    for (const m of read(page).matchAll(/(?:href|src)="((?!https?:|\/\/|#|data:)[^"?#]+\.(?:html|css|js))(?:[?#][^"]*)?"/g)) {
      const target = m[1].startsWith("/") ? path.join(client, m[1]) : path.join(dir, m[1]);
      assert.ok(fs.existsSync(target), page + " -> " + m[1]);
    }
  }
});
