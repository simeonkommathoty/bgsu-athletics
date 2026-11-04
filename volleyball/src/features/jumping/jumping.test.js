export async function verify(page){
  if(await page.locator('#page-jumping canvas').count()!==3)throw new Error('Jump testing charts missing');
  if(await page.locator('#page-jumping tbody tr').count()<9)throw new Error('Jump leaderboard rows missing');
}
