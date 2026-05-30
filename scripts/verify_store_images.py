import re
from pathlib import Path

text = Path(r"c:\clover\js\store.js").read_text(encoding="utf-8")
imgs = re.findall(r"assets/[^\"']+", text)
assets = Path(r"c:\clover\assets")
missing = [i for i in imgs if not (assets / i.replace("assets/", "")).exists()]
print(f"total {len(imgs)} missing {len(missing)}")
for m in missing:
    print(m)
