from pathlib import Path
import re

p = Path(r"d:\wheel\wheel-of-fortune\index.html")
t = p.read_text(encoding="utf-8")

t = re.sub(
    r'(<button type="button" class="btn-send-screenshot" id="sendScreenshotBtn">\s*)[^\n]+(\s*</button>)',
    r"\1\u041e\u0422\u041f\u0420\u0410\u0412\u0418\u0422\u042c \u0421\u041a\u0420\u0418\u041d\u0428\u041e\u0422\2",
    t,
    count=1,
)

t = re.sub(
    r'(<button type="button" class="btn-verify-km is-hidden" id="verifyKmBtn" hidden>\s*)[^\n]+(\s*</button>)',
    r"\1\u041f\u041e\u0414\u0422\u0412\u0415\u0420\u0414\u0418\u0422\u044c \u041f\u0420\u041e\u0411\u0415\u0413\2",
    t,
    count=1,
)

p.write_text(t, encoding="utf-8")
print("ok")
