/* Aides pour piloter l'interface web pfSense (test E2E : réparer une panne exclusivement par les clics). */
const T = require('./lib');
exports.T = T;
exports.start = async function (o) {
  const t = await T.start({ fault: o.fault, dev: o.dev, user: o.user, pwd: o.pwd, seed: o.seed, level: o.level });
  const p = t.p;
  const nav = async (url) => { await p.fill('.baddr', url); await p.press('.baddr', 'Enter'); await p.waitForTimeout(650); };
  t.open2 = async (url) => {
    await t.open('browser', url); await p.waitForTimeout(700);
    if (await p.$('.bwarn')) { await p.click('.bwarn button:has-text("Paramètres avancés")'); await p.click('.bwarn a:has-text("Continuer")'); await p.waitForTimeout(700); }
    if (await p.$('.pfw-login')) { await p.fill('.pfw-login input[type=text]', 'admin'); await p.fill('.pfw-login input[type=password]', 'pfSense#2026'); await p.click('.pfw-login button'); await p.waitForTimeout(800); }
  };
  t.nav = nav;
  t.menu = async (m, i) => { await p.click('.pfw-mi:has-text("' + m + '")'); await p.click('.pfw-mi.open .pfw-dd a:has-text("' + i + '")'); await p.waitForTimeout(650); };
  t.fg = (label) => '.pfw-fg:has(> label.pfw-lbl:text-is("' + label + '"))';
  t.setText = async (label, v) => { await p.fill(t.fg(label) + ' input.form-control', v); };
  t.setSel = async (label, v) => { await p.selectOption(t.fg(label) + ' select.form-control', String(v)); };
  t.setChk = async (label, on) => { const c = p.locator(t.fg(label) + ' input[type=checkbox]'); if ((await c.isChecked()) !== on) await c.click(); };
  t.save = async () => { await p.click('.pfw-form-save, .pfw-main button.btn-primary:has-text("Save")'); await p.waitForTimeout(650); };
  t.apply = async () => { await p.click('.pfw-alert button:has-text("Apply Changes")'); await p.waitForTimeout(650); };
  t.status = () => p.evaluate(() => SIM_APP.run.m.parts.map(x => x.rt && x.rt.status));
  t.banner = () => p.evaluate(() => Array.from(document.querySelectorAll('.pfw-alert')).map(a => a.textContent).join(' | '));
  t.confirmOk = async () => { await p.click('.pfw-modal button.btn-primary'); await p.waitForTimeout(650); };
  return t;
};
