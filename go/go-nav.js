/* /go navigation follows the same five mobile destinations as the CMS homepage. */
(function(){
"use strict";
const sheet=document.getElementById("goMoreSheet");
const backdrop=document.querySelector(".go-more-backdrop");
const buttons=[...document.querySelectorAll(".go-menu-open,.go-dock-more")];
const close=document.querySelector(".go-more-close");
if(!sheet||!backdrop||!buttons.length)return;
let lastFocus=null;
function show(){
  lastFocus=document.activeElement;
  sheet.hidden=false;backdrop.hidden=false;
  document.body.classList.add("go-sheet-open");
  buttons.forEach(button=>button.setAttribute("aria-expanded","true"));
  close?.focus();
}
function hide(){
  sheet.hidden=true;backdrop.hidden=true;
  document.body.classList.remove("go-sheet-open");
  buttons.forEach(button=>button.setAttribute("aria-expanded","false"));
  if(lastFocus?.isConnected)lastFocus.focus();
}
buttons.forEach(button=>button.addEventListener("click",()=>sheet.hidden?show():hide()));
close?.addEventListener("click",hide);
backdrop.addEventListener("click",hide);
document.addEventListener("keydown",event=>{
  if(sheet.hidden)return;
  if(event.key==="Escape"){event.preventDefault();hide();return;}
  if(event.key!=="Tab")return;
  const focusables=[...sheet.querySelectorAll('a[href],button:not([disabled])')];
  if(!focusables.length)return;
  const first=focusables[0],last=focusables[focusables.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
})();