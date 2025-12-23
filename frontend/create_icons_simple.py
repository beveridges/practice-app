import base64
import os

# Minimal valid 1x1 pixel PNG (base64 encoded)
MINIMAL_PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')

os.makedirs('icons', exist_ok=True)
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    with open(f'icons/icon-{size}x{size}.png', 'wb') as f:
        f.write(MINIMAL_PNG)

print(f"Created {len(sizes)} placeholder icon files in icons/")
print("These are minimal 1x1 pixel PNGs - replace with proper icons later.")

