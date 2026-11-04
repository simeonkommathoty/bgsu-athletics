export function createErrorHandler(container) {
  return (scope,error,retry) => {
    console.error(`[Volleyball:${scope}]`,error);
    if(!container)return;
    const message=document.createElement('div');
    message.className='feature-error';
    const label=document.createElement('span');
    label.textContent=`${scope}: ${error?.message || String(error)}`;
    message.append(label);
    if(retry){const button=document.createElement('button');button.className='btn';button.textContent='Retry';button.addEventListener('click',retry);message.append(button);}
    container.replaceChildren(message);
  };
}
