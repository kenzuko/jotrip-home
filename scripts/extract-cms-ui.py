from html.parser import HTMLParser
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parent.parent
EXCLUDE={'admin','dist','.git','node_modules'}
class Texts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.skip=0;self.values=set()
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style','svg'):self.skip+=1
        if self.skip:return
        for key,value in attrs:
            if key in ('alt','placeholder','title','aria-label') and value:
                self.add(value)
    def handle_endtag(self,tag):
        if tag in ('script','style','svg') and self.skip:self.skip-=1
    def handle_data(self,data):
        if not self.skip:self.add(data)
    def add(self,data):
        value=re.sub(r'\s+',' ',data).strip()
        if len(value)>1 and len(value)<600 and re.search(r'[^\W\d_]',value,re.UNICODE):self.values.add(value)
pages={}
for path in ROOT.rglob('*.html'):
    if any(part in EXCLUDE for part in path.relative_to(ROOT).parts):continue
    parser=Texts();parser.feed(path.read_text(encoding='utf-8'))
    relative=path.relative_to(ROOT).as_posix()
    route='/'+relative.replace('index.html','')
    pages[route]=sorted(parser.values)
print(json.dumps({'source':'static HTML','pages':pages},ensure_ascii=False))
