/* OpenPQ CMS - safe story block composition on the existing JSON schema. */
(function(root){
"use strict";
const names=["body","wide","full"],positions=["center","top","bottom","left","right"];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function block(){return{heading:"",body:"",image:"",caption:"",layout:"wide"}}
function insertAfter(sections,index,kind="text"){
 if(!Array.isArray(sections)||!Number.isInteger(index)||index< -1||index>=sections.length||
    !["text","image"].includes(kind))return -1;
 const next=index+1;sections.splice(next,0,block());return next;
}
function splitForImage(sections,index,caret){
 if(!Array.isArray(sections)||!Number.isInteger(index)||index<0||
    index>=sections.length||!sections[index]||typeof sections[index]!=="object")return null;
 const item=sections[index],body=String(item.body||"");
 const pos=Number.isInteger(caret)?Math.min(body.length,Math.max(0,caret)):body.length;
 const tail=body.slice(pos);item.body=body.slice(0,pos);
 const photoIndex=insertAfter(sections,index,"image");if(photoIndex<0)return null;
 let continuation=null;
 if(tail.trim()){continuation=insertAfter(sections,photoIndex,"text");sections[continuation].body=tail}
 return{photoIndex,continuation};
}
const validLayout=x=>names.includes(x)?x:"wide";
const validPosition=x=>positions.includes(x)?x:"center";
function layoutControl(x,path){
 const selected=validLayout(x),p=esc(path),labels={body:"Trong cột",wide:"Ảnh rộng",full:"Toàn khung"};
 return '<fieldset class="story-layout-control"><legend>Độ rộng ảnh trên website</legend><div class="story-layout-choices" role="group" aria-label="Độ rộng ảnh">'+
 names.map(n=>'<button type="button" class="story-layout-choice" data-story-layout-pick="'+n+'" data-story-layout-path="'+p+
 '" aria-pressed="'+String(selected===n)+'"><span class="story-layout-icon '+n+'" aria-hidden="true"><i></i></span>'+labels[n]+'</button>').join("")+
 '</div><div class="story-layout-native"><select tabindex="-1" data-path="'+p+'" aria-label="Độ rộng ảnh">'+
 names.map(n=>'<option value="'+n+'" '+(selected===n?"selected":"")+'>'+labels[n]+'</option>').join("")+'</select></div>'+
 '<p>Ảnh xuất hiện trước phần chữ của đoạn này.</p></fieldset>';
}
function coverControl(x,path){
 const selected=validPosition(x),p=esc(path),labels={center:"Giữa",top:"Trên",bottom:"Dưới",left:"Trái",right:"Phải"};
 return '<fieldset class="story-cover-control"><legend>Ưu tiên vùng ảnh bìa</legend><div class="story-cover-choices">'+
 positions.map(n=>'<button type="button" data-story-cover-pick="'+n+'" data-story-cover-path="'+p+
 '" aria-pressed="'+String(selected===n)+'">'+labels[n]+'</button>').join("")+'</div>'+
 '<div class="story-layout-native"><select tabindex="-1" data-path="'+p+'" aria-label="Vị trí cắt ảnh">'+
 positions.map(n=>'<option value="'+n+'" '+(selected===n?"selected":"")+'>'+labels[n]+'</option>').join("")+'</select></div>'+
 '<p>Chọn phần ảnh cần giữ khi cover bị cắt trên màn hình nhỏ.</p></fieldset>';
}
root.OPQStoryComposer={block,insertAfter,splitForImage,validLayout,validPosition,layoutControl,coverControl};
})(window);