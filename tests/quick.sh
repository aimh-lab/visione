#!/bin/bash
set -e

# 1. Initialize a new empty collection
#    This creates a new directory with the collection default configuration that can be edited.
visione init test-collection

# We run all the following commands in the collection directory.
cd test-collection

# 2. Import a video
#    This command executes the following actions:
#    - copies/downloads the video file into the collection directory,
#    - creates reduced videos,
#    - performs scene detection with defaults parameters and extracts keyframes, and
#    - creates frames thumbnails.
#    After it is imported, a video is ready to be analyzed.
visione import --id bunny "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_2mb.mp4"

# 3. Analyze video(s)
#    This commands analyzes all the imported videos. You can analyze specific videos only by specifying --id <video_id>.
visione analyze

# 4. Add analyzed video(s) to the index
#    This command adds the analyzed video to the indices (Lucene & FAISS) and makes it available for search.
visione index --id bunny

# 5. Start VISIONE!
#    Starts all the frontend and backend services. You can access the web UI at http://localhost:8000/
visione serve