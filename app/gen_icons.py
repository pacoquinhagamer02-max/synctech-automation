from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), 'icons')
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def gradient_bg(size, c1=(124,58,237), c2=(192,132,252)):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2*size)
            px[x, y] = lerp(c1, c2, t)
    return img

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    return mask

def make_icon(size, radius_ratio=0.22, glow=True, maskable=False):
    pad = 0
    canvas_size = size
    bg = gradient_bg(canvas_size, (91, 33, 182), (192, 132, 252))

    # subtle diagonal glow accent (top-left lighter spot)
    glow_layer = Image.new('RGB', (canvas_size, canvas_size), (0,0,0))
    gd = ImageDraw.Draw(glow_layer)
    gd.ellipse([-canvas_size*0.3, -canvas_size*0.3, canvas_size*0.6, canvas_size*0.6], fill=(255,255,255))
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(canvas_size*0.18))
    bg = Image.blend(bg, Image.composite(Image.new('RGB',(canvas_size,canvas_size),(255,255,255)), bg, glow_layer.convert('L').point(lambda p: p*0.35)), 0)
    bg.paste(Image.composite(Image.new('RGB',(canvas_size,canvas_size),(255,255,255)), bg, glow_layer.convert('L').point(lambda p: int(p*0.22))), (0,0))

    if maskable:
        # maskable icons need full-bleed bg (safe zone ~ 40% center), no rounding
        icon = bg.convert('RGBA')
    else:
        mask = rounded_mask(canvas_size, int(canvas_size*radius_ratio))
        icon = Image.new('RGBA', (canvas_size, canvas_size), (0,0,0,0))
        icon.paste(bg, (0,0), mask)

    draw = ImageDraw.Draw(icon)

    # Draw stylized "S" bolt mark using a bold sans font if available, else fallback shape
    mark_scale = 0.56 if not maskable else 0.34
    font_size = int(canvas_size * mark_scale)
    font = None
    for fp in [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\seguisb.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
    ]:
        if os.path.exists(fp):
            font = ImageFont.truetype(fp, font_size)
            break
    if font is None:
        font = ImageFont.load_default()

    text = "S"
    bbox = draw.textbbox((0,0), text, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    tx = (canvas_size - tw)/2 - bbox[0]
    ty = (canvas_size - th)/2 - bbox[1]

    # soft shadow for depth
    shadow = Image.new('RGBA', (canvas_size, canvas_size), (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    sd.text((tx, ty+canvas_size*0.02), text, font=font, fill=(30,10,60,140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(canvas_size*0.02))
    icon = Image.alpha_composite(icon, shadow)
    draw = ImageDraw.Draw(icon)
    draw.text((tx, ty), text, font=font, fill=(255,255,255,255))

    return icon

# Standard + maskable icons
for size in [192, 512]:
    make_icon(size).save(os.path.join(OUT, f'icon-{size}.png'))

make_icon(512, maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))

# Apple touch icon (no transparency, iOS adds its own rounding)
apple = make_icon(180, radius_ratio=0.0)
apple_bg = Image.new('RGB', (180,180), (91,33,182))
apple_bg.paste(apple, (0,0), apple)
apple_bg.save(os.path.join(OUT, 'apple-touch-icon.png'))

# Favicon
make_icon(64).save(os.path.join(OUT, 'favicon-64.png'))

print("done")
