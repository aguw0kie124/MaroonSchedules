with open('/tmp/siddarth_events.tsx', 'r') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if "const renderHorizontalDiscover =" in l:
        start = i
        for j in range(start, len(lines)):
            if lines[j].strip() == "};": # end of block
                pass
            if lines[j].strip() == "const renderList = () => (":
                end = j
                break
        with open('extracted.tsx', 'w') as out:
            out.writelines(lines[start:end])
        break
