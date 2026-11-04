export async function verify(page){await page.locator('#wl-sort').selectOption('jumpVol');await page.locator('#wl-athlete-sel').selectOption({index:1});}
