import sys
import re

with open('Frontend/components/Profile.tsx', 'r') as f:
    code = f.read()

# 1. Move `useAppShellStore` and related variables up
# Let's find exactly what to move.
block_to_move = """  const userDisplayName = useAppShellStore((state) => state.userDisplayName);
  const userBio = useAppShellStore((state) => state.userBio);
  const userGender = useAppShellStore((state) => state.userGender);
  const showPingsOnProfile = useAppShellStore((state) => state.showPingsOnProfile);
  const fullName = useAppShellStore((state) => state.userFullName);
  const setUserProfile = useAppShellStore((state) => state.setUserProfile);
"""
if block_to_move in code:
    code = code.replace(block_to_move, "")
    # Insert right after `const { user } = useUser();`
    insert_point = "const { user } = useUser();"
    code = code.replace(insert_point, insert_point + "\n" + block_to_move)

# 2. Change all activeTab === 'pings' or setActiveTab('pings') to 'posts'
# Be careful to only change activeTab related ones.
code = code.replace("setActiveTab('pings')", "setActiveTab('posts')")
code = code.replace("activeTab === 'pings'", "activeTab === 'posts'")
code = code.replace("activeTab === 'personal'", "activeTab === 'unknown' /* personal was removed */")

# 3. TS2350: Only a void function can be called with the 'new' keyword.
# Profile.tsx(272,76): error TS2350
# Let's check what uses `new` as a function call instead of instantiation.
# Usually things like `new (some_var)()` which TypeScript dislikes.
# In React Query, `new QueryClient()` is correct. Maybe something with Date?
# I'll let tsc complain about it and fix it manually if it's tricky.
# Wait, let's fix `website` first.
code = code.replace("website: website,", "")
code = code.replace("website: user?.publicMetadata?.website as string || '',", "")
code = code.replace("website,", "")

with open('Frontend/components/Profile.tsx', 'w') as f:
    f.write(code)
