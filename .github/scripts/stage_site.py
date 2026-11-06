"""Stage the public Mioko site for GitHub Pages without development snapshots."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[2]
output = root / '_site'
if output.exists():
    shutil.rmtree(output)
output.mkdir()
for source in root.iterdir():
    if source.is_file() and (
        source.suffix in {'.html', '.css', '.js', '.xml', '.apk'}
        or source.name in {'CNAME', 'app-version.json', 'robots.txt'}
    ) and source.name != 'auth-before.js':
        shutil.copy2(source, output / source.name)
for name in ('assets', 'downloads'):
    shutil.copytree(root / name, output / name)
(output / '.nojekyll').touch()
for name in ('index.html', 'auth.js', 'app.js', 'config.js', 'app-version.json'):
    assert (output / name).is_file(), f'Missing required public file: {name}'
print(f'Prepared {sum(p.is_file() for p in output.rglob("*"))} public site files.')
