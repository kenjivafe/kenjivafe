# Writes README.md. Each card is a <picture> that picks light/dark (GitHub theme)
# and desktop/phone (viewport under 600px) versions from ./assets.
import hashlib, pathlib

# Cache-busting: each image URL carries a hash of its file, so GitHub shows
# a fresh card as soon as it changes instead of a cached copy.
def v(file):
    f = pathlib.Path(__file__).resolve().parent.parent / "assets" / file
    return "?v=" + hashlib.sha1(f.read_bytes()).hexdigest()[:8] if f.exists() else ""

def pic(name, alt, width="100%", height=None, mobile=True):
    size = f'height="{height}"' if height else f'width="{width}"'
    a = "./assets/"
    src = []
    if mobile:
        src.append(f'<source media="(prefers-color-scheme: light) and (max-width: 600px)" srcset="{a}{name}-m-light.svg{v(name + '-m-light.svg')}" />')
    src.append(f'<source media="(prefers-color-scheme: light)" srcset="{a}{name}-light.svg{v(name + '-light.svg')}" />')
    if mobile:
        src.append(f'<source media="(max-width: 600px)" srcset="{a}{name}-m-dark.svg{v(name + '-m-dark.svg')}" />')
    return "<picture>" + "".join(src) + f'<img src="{a}{name}-dark.svg{v(name + '-dark.svg')}" {size} alt="{alt}" /></picture>'

link = lambda url, inner: f'<a href="{url}">{inner}</a>'
blk = lambda *items, align="center": f'<p align="{align}">\n' + "\n".join("  " + i for i in items) + "\n</p>\n"
work = [
    ("https://rigko.com", "Rigko — Custom PC Configuration & Logistics SaaS"),
    ("https://gymcentrix.vercel.app", "Gymcentrix — Enterprise Gym Management & Analytics Platform"),
    ("https://gritdp.com", "Grit Digital Performance — Sports Data Infrastructure & Team Management"),
    ("https://resq-link-kappa.vercel.app", "RESQ-Link — Real-time Emergency Dispatch & Event Response"),
]
out = [
    "<!-- Generated: cards by scripts/build-stats.mjs (edit CONTENT there), this file by scripts/write-readme.py -->\n",
    blk(pic("hero", "Kenji. Software Engineer & Builder")),
    blk(pic("about", "I build precise, thoughtful digital products — from scalable backend architectures to fluid user interfaces.")),
    blk(
        link("https://kenjivafe.vercel.app", pic("btn-portfolio", "View Portfolio", height=40, mobile=False)),
        link("https://linkedin.com/in/kenji-von-ashley", pic("btn-linkedin", "LinkedIn", height=40, mobile=False)),
        link("mailto:kenjivafe@gmail.com", pic("btn-email", "Email", height=40, mobile=False)),
        align="left",
    ),
    blk(*[link(u, pic(f"work-{i + 1}", a)) for i, (u, a) in enumerate(work)]),
    blk(pic("more", "Also built: Tenantra, Airtime, Perbee, SPUP AdServIS, Doctor Smile, DICT Geofence, Apit Lako")),
    blk(pic("experience", "Experience")),
    blk(pic("capabilities", "Capabilities")),
    blk(pic("activity", "GitHub activity")),
    blk(link("mailto:kenjivafe@gmail.com", pic("contact", "Let's build together. kenjivafe@gmail.com"))),
    blk(pic("footer", "Kenji Von Ashley")),
]
open("README.md", "w").write("\n".join(out))

