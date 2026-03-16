<script>
  let showDropzone = false;
  let dragCounter = 0;

  function onDragEnter(e) {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      dragCounter++;
      showDropzone = true;
    }
  }

  function onDragLeave(e) {
    dragCounter--;
    if (dragCounter === 0) {
      showDropzone = false;
    }
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  async function onDrop(e) {
    e.preventDefault();
    dragCounter = 0;
    showDropzone = false;
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (!file) return;
    
    // Process file
  }
</script>
