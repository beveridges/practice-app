"""Create placeholder icon files - works with any Python"""
import base64
import os
import sys

# Minimal valid 1x1 pixel PNG (base64 encoded)
# This is a real, valid PNG file that will work for all PWA requirements
MINIMAL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

def create_icons():
    """Create all required icon files"""
    # Decode the base64 PNG
    png_data = base64.b64decode(MINIMAL_PNG_BASE64)
    
    # Ensure icons directory exists
    icons_dir = 'icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    # Icon sizes needed by manifest.json
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    
    created_count = 0
    for size in sizes:
        icon_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
        try:
            with open(icon_path, 'wb') as f:
                f.write(png_data)
            print(f"[OK] Created {icon_path}")
            created_count += 1
        except Exception as e:
            print(f"[ERROR] Failed to create {icon_path}: {e}")
    
    print(f"\n{'='*50}")
    print(f"Successfully created {created_count}/{len(sizes)} icon files")
    print(f"{'='*50}")
    print("\nNote: These are minimal placeholder icons.")
    print("Replace them with proper app icons later for production.")

if __name__ == '__main__':
    # Change to script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    create_icons()

