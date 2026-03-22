import os, re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.content = f.read()

    # If COLORS not used, skip
    if 'COLORS' not in content:
        return

    # Check if from SharedUI
    if not re.search(r'import.*COLORS.*SharedUI', content):
        return

    # 1. Replace import { COLORS } with import { useTheme }
    content = re.sub(r"import\s*\{\s*([^}]*)COLORS([^}]*)\}\s*from\s+['\"](.*?)SharedUI['\"]", 
                     r"import { \1useTheme\2} from '\3SharedUI'", content)

    # 2. Add const { COLORS } = useTheme(); to every exported component
    def comp_repl(m):
        comp_decl = m.group(0)
        return comp_decl + "\n    const { COLORS } = useTheme();"

    # Match components like `export function Dashboard() {` or `export const Card = ({...}) => {`
    content = re.sub(r'export (?:default )?(?:function|const) \w+\s*=?\s*(?:\([^)]*\))?\s*(?::\s*[^=>]+)?\s*(?:=>)?\s*\{', comp_repl, content)
    
    # 3. Handle styles = StyleSheet.create({
    content = re.sub(r'const styles = StyleSheet.create\(\{', r'const getStyles = (COLORS: any) => StyleSheet.create({', content)
    
    # 4. If we changed styles to getStyles, we must call it in the component
    if 'getStyles' in content:
        # insert const styles = getStyles(COLORS); right after const { COLORS } = useTheme();
        content = re.sub(r'(const \{ COLORS \} = useTheme\(\);)', r'\1\n    const styles = getStyles(COLORS);', content)

    # Write back
    with open(filepath, 'w') as f:
        f.write(content)

for root, dirs, files in os.walk('components'):
    for file in files:
        if file.endswith('.tsx'):
            process_file(os.path.join(root, file))
process_file('App.tsx')
print("Done")
