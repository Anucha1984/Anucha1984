---
description: สร้างวิดีโอแนวตั้งพากย์ไทยจากไอเดียบรรทัดเดียว (NiThan Studio)
argument-hint: <ไอเดียหรือชื่อเรื่อง> [--genre cdrama|ghost|folktale] [--style pixar|comic-us|china|korea|thai|thai-retro|anime] [--length short|medium|long]
allowed-tools: Bash(node bin/nithan.js:*)
---

Create a vertical Thai-dubbed video with NiThan Studio from this request: $ARGUMENTS

1. Split the request into the story idea and any `--flags` the user typed. Run, from the repository root, with the idea as ONE double-quoted argument and the flags after it unquoted:

   `node bin/nithan.js "<idea>" [flags]`

   - If the user gave no `--genre`, pick one that fits the idea: `ghost` for ghost/horror stories, `cdrama` for Chinese-style short drama (CEOs, revenge, rebirth, hidden identity), `folktale` for Thai folktales (the default). Do not add other flags the user did not ask for.
   - If the request is empty, ask the user for an idea instead of running anything. `node bin/nithan.js list` shows the genres and styles.
   - The command takes several minutes (Claude writes the script and draws every scene, then the video is rendered). Use a long timeout (10 minutes) or run it in the background and wait; do not re-run it while it is still working.
2. When it finishes, report in Thai: the title, the path of the video (the `วิดีโอ:` line), the project folder, and the `nithan --continue …` hint if one was printed. If it printed a note that there is no voice-over, pass that on.
3. If it fails, show the `ไม่สำเร็จ:` message and suggest the fix it names. Do not retry with `--mock` unless the user asks.
