"""Generate placeholder icon files for PWA"""
import base64
import os

# Minimal valid 1x1 pixel PNG (base64 encoded)
MINIMAL_PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

# Ensure icons directory exists
os.makedirs('icons', exist_ok=True)

# Icon sizes needed
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# Create each icon file
for size in sizes:
    icon_path = f'icons/icon-{size}x{size}.png'
    with open(icon_path, 'wb') as f:
        f.write(MINIMAL_PNG)
    print(f"Created {icon_path}")

print(f"\n✅ Created {len(sizes)} placeholder icon files in icons/")
print("Note: These are minimal 1x1 pixel PNGs - replace with proper icons later.")

