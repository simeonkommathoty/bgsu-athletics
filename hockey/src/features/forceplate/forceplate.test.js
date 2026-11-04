export async function verify(page){await page.locator('#fp-sort').selectOption('rsi');await page.locator('#cmj-athlete-sel').selectOption({index:1});}
