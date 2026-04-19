import os
import re

html_dir = r"C:\Users\Soham\OneDrive\Documents\Projects\NagarSetu-Admin\zip_contents\stitch_remix_of_nagar_setu_civic_portal"
out_dir = r"C:\Users\Soham\OneDrive\Documents\Projects\NagarSetu-Admin\admin-portal\src\pages\generated"

def html_to_jsx(html_content):
    jsx = html_content
    # Replace comments
    jsx = re.sub(r'<!--(.*?)-->', r'{/* \1 */}', jsx, flags=re.DOTALL)
    
    jsx = jsx.replace('class="', 'className="')
    jsx = jsx.replace('for="', 'htmlFor="')
    jsx = jsx.replace('tabindex="', 'tabIndex="')
    jsx = jsx.replace('viewbox="', 'viewBox="')
    jsx = jsx.replace('stroke-width="', 'strokeWidth="')
    jsx = jsx.replace('stroke-linecap="', 'strokeLinecap="')
    jsx = jsx.replace('stroke-linejoin="', 'strokeLinejoin="')
    jsx = jsx.replace('fill-rule="', 'fillRule="')
    jsx = jsx.replace('clip-rule="', 'clipRule="')
    jsx = jsx.replace('xmlns:xlink="', 'xmlnsXlink="')

    # Self close tags that are often not closed in standard html (but exported designs might be proper xml)
    jsx = re.sub(r'(<img[^>]*?)(?<!/)>', r'\1 />', jsx)
    jsx = re.sub(r'(<input[^>]*?)(?<!/)>', r'\1 />', jsx)
    jsx = re.sub(r'(<hr[^>]*?)(?<!/)>', r'\1 />', jsx)
    jsx = re.sub(r'(<br[^>]*?)(?<!/)>', r'\1 />', jsx)

    # Hack to convert inline style strings to objects: style="abc: 123; def: 456;" -> style={{abc: '123', def: '456'}}
    def repl_style(match):
        style_str = match.group(1)
        if not style_str.strip(): return 'style={{}}'
        rules = [r for r in style_str.split(';') if r.strip()]
        obj_props = []
        for r in rules:
            if ':' not in r: continue
            k, v = r.split(':', 1)
            k = k.strip()
            v = v.strip().replace("'", '"')
            parts = k.split('-')
            k_camel = parts[0] + ''.join(p.capitalize() for p in parts[1:])
            obj_props.append(f'{k_camel}: \'{v}\'')
        return 'style={{' + ', '.join(obj_props) + '}}'
    
    jsx = re.sub(r'style="([^"]*)"', repl_style, jsx)

    return jsx

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

for folder in os.listdir(html_dir):
    folder_path = os.path.join(html_dir, folder)
    if os.path.isdir(folder_path):
        html_file = os.path.join(folder_path, "code.html")
        if os.path.exists(html_file):
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()

            match = re.search(r'<body[^>]*>(.*?)</body>', content, re.DOTALL | re.IGNORECASE)
            if match:
                body_content = match.group(1)
            else:
                body_content = content
            
            jsx_body = html_to_jsx(body_content)
            comp_name = "".join(x.capitalize() for x in folder.split('_'))

            out_content = f"""import React from 'react';

export default function {comp_name}() {{
  return (
    <>
      {jsx_body}
    </>
  );
}}
"""
            out_filepath = os.path.join(out_dir, f"{comp_name}.jsx")
            with open(out_filepath, 'w', encoding='utf-8') as f:
                f.write(out_content)

print("Conversion complete.")
