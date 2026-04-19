import glob
files = glob.glob('src/**/*.jsx', recursive=True)
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    new_content = content.replace('href="#"', 'href="javascript:void(0)"').replace("href='#'", "href='javascript:void(0)'")
    if new_content != content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(new_content)
        print(f'Fixed {f}')
