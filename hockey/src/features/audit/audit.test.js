export async function verify(page){await page.locator('#page-audit').getByText('⟳ REFRESH',{exact:true}).click();}
