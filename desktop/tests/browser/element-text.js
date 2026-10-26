// Actual React field: IME drafts must not commit; finalized Unicode must survive.
async (page) => {
  const test = await page.context().newPage();
  await test.goto('http://127.0.0.1:1420/');
  await test.evaluate(async () => {
    const reactModule = await import('/node_modules/.vite/deps/react.js');
    const React = reactModule.default ?? reactModule;
    const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
    const {createRoot} = domModule.default ?? domModule;
    const {ElementTextField} = await import('/src/components/elements/ElementTextField.tsx');
    const host = document.createElement('div');document.body.replaceChildren(host);
    window.fieldCheck = {value: '', commits: []};
    function Harness() {
      const [value, setValue] = React.useState('');
      return React.createElement(ElementTextField, {value,
        stage: text => {window.fieldCheck.value = text;setValue(text);},
        commit: () => window.fieldCheck.commits.push(window.fieldCheck.value),
      });
    }
    createRoot(host).render(React.createElement(Harness));
  });
  const field = test.getByRole('textbox', {name:'Element text'});
  await field.waitFor();
  await field.dispatchEvent('compositionstart', {data:''});
  await field.fill('日本語');
  await field.dispatchEvent('keyup', {key:'Process', isComposing:true});
  if ((await test.evaluate(() => window.fieldCheck.commits)).length) throw new Error('IME draft was committed early');
  await field.dispatchEvent('compositionend', {data:'日本語'});
  if ((await test.evaluate(() => window.fieldCheck.commits)).at(-1) !== '日本語') throw new Error('Final IME text was not committed');
  for (const label of ['Zażółć gęślą jaźń', 'Підписатися', 'اشترك الآن', 'הרשמה', '👍'.repeat(80)]) {
    await field.fill(label);await field.blur();
    if ((await test.evaluate(() => window.fieldCheck.commits)).at(-1) !== label) throw new Error('Label changed during input: '+label);
  }
  await field.fill('👍'.repeat(81));await field.blur();
  if ((await test.evaluate(() => window.fieldCheck.value)) !== '👍'.repeat(80)) throw new Error('Unicode character budget failed');
  await test.close();
}
