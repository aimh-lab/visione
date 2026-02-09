<script>
  import { createEventDispatcher } from "svelte";
  import InputModal from "./InputModal.svelte";

  export let textareas = [];
  export let availableImages = []; // ✅ NUOVO: immagini disponibili dal resultset
  export let textareaImages = {};

  let modalConfig = {
    isOpen: false,
    title: '',
    icon: '',
    fields: [],
    description: '',
    targetIndex: null,
    filterType: ''
  };


  const dispatch = createEventDispatcher();

  let isSelectingImageFor = null; // index della textarea che sta selezionando
  
  const add = (i) => dispatch("add", { index: i });
  const remove = (i) => dispatch("remove", { index: i });
  const toggle = (index) => {
    dispatch("toggle", { index }); 
    setTimeout(() => dispatch("search"), 0);
  };
  const update = (i, value) => dispatch("update", { index: i, value });
  
function swapQueries(indexA, indexB) {
  if (indexB < 0 || indexB >= textareas.length) return;
  
  // ✅ Scambia le immagini associate
  const tempImages = textareaImages[indexA];
  textareaImages[indexA] = textareaImages[indexB];
  textareaImages[indexB] = tempImages;
  textareaImages = {...textareaImages}; // Trigger reactivity
  
  dispatch("swap", { indexA, indexB });
  setTimeout(() => dispatch("search"), 100);
}


  const handleKeyDown = (e, textareaIndex) => {
    if (e.key === "Enter" && !e.shiftKey && textareas[textareaIndex]?.enabled) {
      e.preventDefault();
      dispatch("search");
    }
  };

  // ✅ Gestione menu dropdown
  let openMenuIndex = null;
  let fileInput;

  function toggleMenu(index) {
    openMenuIndex = openMenuIndex === index ? null : index;
  }

  function closeMenu() {
    openMenuIndex = null;
  }

  // ✅ NUOVO: Gestione immagini

  function insertShortcut(index, shortcut) {
    const currentValue = textareas[index].value || '';
    update(index, currentValue + shortcut);
    closeMenu();
  }

  function handleImageFromFile(index) {
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target.result;
          addImageToTextarea(index, dataUrl, file.name, 'file');
        };
        reader.readAsDataURL(file);
      }
    };
    fileInput.click();
    closeMenu();
  }

  function handleImageFromURL(index) {
    const url = prompt('Enter image URL:');
    if (url) {
      addImageToTextarea(index, url, 'Image from URL', 'url');
    }
    closeMenu();
  }

  function openImagePicker(index) {
    isSelectingImageFor = index;
    closeMenu();
    // ✅ Dispatch evento per attivare modalità selezione
    dispatch('startImageSelection', { textareaIndex: index });
  }

  export function handleImageSelected(image) {
    if (isSelectingImageFor === null) return;
    
    addImageToTextarea(
      isSelectingImageFor,
      image.url,
      `${image.imgId || image.title}`,
      'result',
      image.imgId
    );
    
    isSelectingImageFor = null;
    dispatch('imageSelected');
  }

  export function cancelSelection() {
    isSelectingImageFor = null;
  }


  // ✅ MODIFICATO: addImageToTextarea ora accetta imgId opzionale
  function addImageToTextarea(index, url, name, type, imgId = null) {
    if (!textareaImages[index]) {
      textareaImages[index] = [];
    }
    textareaImages[index] = [...textareaImages[index], { url, name, type, imgId }];
    
    // ✅ Notifica il padre del cambiamento
    dispatch('updateImages', { index, images: textareaImages[index] });
  }

  function removeImageFromTextarea(textareaIndex, imageIndex) {
    textareaImages[textareaIndex] = textareaImages[textareaIndex].filter((_, i) => i !== imageIndex);

    
    // ✅ Notifica il padre
    dispatch('updateImages', { index: textareaIndex, images: textareaImages[textareaIndex] });
  }

  // Click outside per chiudere menu
  function handleClickOutside(event) {
    if (openMenuIndex !== null && !event.target.closest('.menu-container')) {
      closeMenu();
    }
  }

  function openDateFilterModal(index) {

    modalConfig = {
      isOpen: true,
      title: 'Add Date Filter',
      icon: 'calendar',
      description: 'Filter by capture date range',
      targetIndex: index,
      filterType: 'date',
      fields: [
        {
          name: 'from',
          label: 'From Date',
          type: 'date',
          placeholder: 'YYYY-MM-DD',
          value: '',
          hint: 'Leave empty for no start limit'
        },
        {
          name: 'to',
          label: 'To Date',
          type: 'date',
          placeholder: 'YYYY-MM-DD',
          value: '',
          hint: 'Leave empty for no end limit'
        }
      ]
    };

    closeMenu();
  }
  
  function openUrlModal(index) {

    modalConfig = {
      isOpen: true,
      title: 'Add Image from URL',
      icon: 'link',
      description: 'Paste an image URL',
      targetIndex: index,
      filterType: 'imageUrl',
      fields: [
        {
          name: 'url',
          label: 'Image URL',
          type: 'url',
          placeholder: 'https://example.com/image.jpg',
          value: '',
          required: true,
          hint: 'Must be a valid image URL'
        },
        {
          name: 'name',
          label: 'Image Name (optional)',
          type: 'text',
          placeholder: 'My image',
          value: ''
        }
      ]
    };

    closeMenu();
  }
  
  function openTypeFilterModal(index) {
    modalConfig = {
      isOpen: true,
      title: 'Add Type Filter',
      icon: 'filter',
      description: 'Filter by content type',
      targetIndex: index,
      filterType: 'type',
      fields: [
        {
          name: 'type',
          label: 'Content Type',
          type: 'select',
          value: 'video',
          options: [
            { value: 'video', label: 'Video' },
            { value: 'image', label: 'Image' },
            { value: 'audio', label: 'Audio' },
            { value: 'document', label: 'Document' }
          ]
        }
      ]
    };
    closeMenu();
  }
  
  function handleModalSubmit(event) {

    const data = event.detail;
    const { targetIndex, filterType } = modalConfig;
    
    if (filterType === 'date') {
      let dateFilter = 'date:';
      if (data.from && data.to) {
        dateFilter += `${data.from}..${data.to}`;
      } else if (data.from) {
        dateFilter += `>${data.from}`;
      } else if (data.to) {
        dateFilter += `<${data.to}`;
      } else {
        dateFilter = ''; // No dates entered
      }
      
      if (dateFilter) {
        const currentValue = textareas[targetIndex].value || '';
        update(targetIndex, currentValue + ' ' + dateFilter);
      }
    } else if (filterType === 'imageUrl') {
      if (data.url) {
        addImageToTextarea(
          targetIndex,
          data.url,
          data.name || 'Image from URL',
          'url'
        );
      }
    } else if (filterType === 'type') {
      const currentValue = textareas[targetIndex].value || '';
      update(targetIndex, currentValue + ' type:' + data.type);
    }
    
    modalConfig.isOpen = false;
  }
  
  function handleModalClose() {

    modalConfig.isOpen = false;
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="space-y-4">
  <!-- Info box -->
  <div class="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-700/50 rounded-lg p-3">
    <div class="flex items-start space-x-2">
      <div class="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="flex-1">
        <h4 class="text-xs font-bold text-blue-300 mb-0.5">Temporal Sequence Search</h4>
        <p class="text-[10px] text-blue-200/80 leading-relaxed">
          Find videos where scenes appear <strong>in order</strong> over time.
        </p>
      </div>
    </div>
  </div>

  <!-- Query cards -->
  <div class="space-y-3">
    {#each textareas as textarea, i}
      <div class="group relative">
        <!-- Card principale -->
        <div>
          <!-- Header con numero integrato -->
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <!-- Badge temporale CON numero -->
            <div class="flex items-center space-x-1.5 px-2.5 py-1 rounded-full
                        {textarea.enabled 
                          ? 'bg-blue-900/40 border border-blue-700/60' 
                          : 'bg-gray-800/40 border border-gray-700/60'}">
              <!-- Numero -->
              <div class="flex items-center justify-center w-4 h-4 rounded-full
                          {textarea.enabled ? 'bg-blue-600' : 'bg-gray-600'}">
                <span class="text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
              
              <!-- Icona clock -->
              <svg class="w-2.5 h-2.5 {textarea.enabled ? 'text-blue-400' : 'text-gray-500'}" 
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              
              <!-- Label temporale -->
              <span class="text-[10px] font-bold uppercase tracking-wide
                           {textarea.enabled ? 'text-blue-300' : 'text-gray-500'}">
                {i === 0 ? 'First' : i === textareas.length - 1 ? 'Finally' : 'Then'}
              </span>
            </div>
            
            <!-- Controlli compatti -->
            <div class="flex items-center space-x-0.5">
              {#if i > 0}
                <button
                  type="button"
                  on:click|stopPropagation={() => swapQueries(i, i - 1)}
                  title="Move up"
                  class="p-1 rounded hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-all"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 15l7-7 7 7"/>
                  </svg>
                </button>
              {/if}

              {#if i < textareas.length - 1}
                <button
                  type="button"
                  on:click|stopPropagation={() => swapQueries(i, i + 1)}
                  title="Move down"
                  class="p-1 rounded hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 transition-all"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              {/if}

              {#if (i > 0 || i < textareas.length - 1)}
                <div class="w-px h-3 bg-gray-700 mx-0.5"></div>
              {/if}

              <!-- Toggle compatto -->
              <button
                type="button"
                on:click={() => toggle(i)}
                title={textarea.enabled ? 'Skip this step' : 'Enable this step'}
                class="relative inline-flex h-4 w-7 items-center rounded-full transition-colors
                       {textarea.enabled ? 'bg-green-600' : 'bg-gray-600'}"
              >
                <span
                  class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                         {textarea.enabled ? 'translate-x-3' : 'translate-x-0.5'}"
                ></span>
              </button>
            </div>
          </div>
          
          <!-- Textarea container con remove button sovrapposto -->
          <div class="relative textarea-container">
            <!-- ✅ Remove button nell'angolo in alto a destra -->
            {#if textareas.length > 1}
              <button
                type="button"
                on:click={() => remove(i)}
                title="Remove step"
                class="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center
                       rounded-md bg-red-600/90 hover:bg-red-600 text-white 
                       shadow-lg transition-all opacity-0 group-hover:opacity-100
                       hover:scale-110"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            {/if}

            <!-- Container ibrido con immagini -->
            <div class="relative">
              <!-- Immagini sopra la textarea -->
              {#if textareaImages[i]?.length > 0}
                <div class="flex flex-wrap gap-2 p-2 bg-gray-900/80 rounded-t-2xl border-2 border-b-0
                           {textarea.enabled ? 'border-blue-500/50' : 'border-gray-700/50'}">
                  {#each textareaImages[i] as image, imgIdx}
                    <div class="relative group/img">
                      <img 
                        src={image.url} 
                        alt={image.name}
                        class="w-20 h-20 object-cover rounded-lg border-2 
                               {image.type === 'result' ? 'border-green-500' : 'border-gray-700'}"
                      />
                      <!-- ✅ Badge per immagini da resultset -->
                      {#if image.type === 'result'}
                        <div class="absolute top-0 left-0 bg-green-500 text-white text-[8px] font-bold px-1 rounded-br">
                          RESULT
                        </div>
                      {/if}
                      <!-- Remove image button -->
                      <button
                        type="button"
                        on:click={() => removeImageFromTextarea(i, imgIdx)}
                        class="absolute -top-1 -right-1 w-5 h-5 bg-red-600 hover:bg-red-700 
                               rounded-full flex items-center justify-center shadow-lg
                               opacity-0 group-hover/img:opacity-100 transition-opacity"
                        title="Remove image"
                      >
                        <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                      <!-- Image name tooltip -->
                      <div class="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[8px] px-1 py-0.5 
                                  truncate rounded-b-lg opacity-0 group-hover/img:opacity-100 transition-opacity">
                        {image.name}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Textarea -->
              <textarea
                class="w-full p-2.5 pb-8 border-2 resize-none transition-all duration-200 font-mono text-xs
                       {textareaImages[i]?.length > 0 ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'}
                       {textarea.enabled 
                         ? 'bg-gray-900 text-white border-blue-500/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 shadow-lg' 
                         : 'bg-gray-800/30 text-gray-500 border-gray-700/50 cursor-not-allowed opacity-60 line-through'}"
                rows="4"
                bind:value={textarea.value}
                placeholder={textarea.enabled 
                  ? `What happens ${i === 0 ? 'first' : 'at this point'}?` 
                  : "This step is skipped"}
                disabled={!textarea.enabled}
                on:input={(e) => update(i, e.target.value)}
                on:keydown={(e) => handleKeyDown(e, i)}
              ></textarea>
            </div>

            <!-- Menu dropdown button -->
            <div class="absolute bottom-2.5 left-0 flex items-center justify-between px-2 menu-container">
              <div class="relative">
                <button
                  type="button"
                  on:click|stopPropagation={() => toggleMenu(i)}
                  title="Add attachment or filter"
                  class="p-1 rounded text-blue-400 hover:bg-blue-600/20 shadow transition-all hover:scale-110
                         {openMenuIndex === i ? 'bg-blue-600/30' : ''}"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </button>

                <!-- Dropdown menu -->
                {#if openMenuIndex === i}
                  <div class="absolute bottom-full left-0 mb-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50 animate-slide-up">
                    <div class="px-3 py-2 bg-gray-900/50 border-b border-gray-700">
                      <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Add to Query</span>
                    </div>

                    <div class="py-1">
                      <!-- ✅ Image from Results -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openImagePicker(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-blue-600/20 text-left transition-colors group"
                        disabled={availableImages.length === 0}
                      >
                        <div class="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                          <svg class="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                            <path d="M9 12l2 2 4-4"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Pick from Results</div>
                          <div class="text-[10px] text-gray-400">
                            {availableImages.length > 0 
                              ? `Click to select from ${availableImages.length} results` 
                              : 'No results available'}
                          </div>
                        </div>
                      </button>

                      <div class="my-1 h-px bg-gray-700"></div>

                      <!-- Image from file -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => handleImageFromFile(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-blue-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
                          <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Image from File</div>
                          <div class="text-[10px] text-gray-400">Upload from computer</div>
                        </div>
                      </button>

                      <!-- Image from URL -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openUrlModal(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-blue-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                          <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Image from URL</div>
                          <div class="text-[10px] text-gray-400">Paste image link</div>
                        </div>
                      </button>

                      <div class="my-1 h-px bg-gray-700"></div>


            <!-- Date filter -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openDateFilterModal(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-blue-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                          <svg class="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Add Date Filter</div>
                          <div class="text-[10px] text-gray-400 font-mono">date:YYYY-MM-DD</div>
                        </div>
                      </button>

                      <!-- Type filter -->
                      <button
                        type="button"
                        on:click|stopPropagation={() => openTypeFilterModal(i)}
                        class="w-full px-3 py-2 flex items-center space-x-3 hover:bg-blue-600/20 text-left transition-colors group"
                      >
                        <div class="w-8 h-8 rounded-lg bg-orange-600/20 flex items-center justify-center group-hover:bg-orange-600/30 transition-colors">
                          <svg class="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                          </svg>
                        </div>
                        <div class="flex-1">
                          <div class="text-xs font-medium text-white">Add Type Filter</div>
                          <div class="text-[10px] text-gray-400 font-mono">type:format</div>
                        </div>
                      </button>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            <div class="absolute bottom-2.5 right-0 flex items-center justify-between px-2">
              <span class="text-[9px] font-medium text-gray-400">
                {textarea.value?.length || 0} chars
                {#if textareaImages[i]?.length > 0}
                  · {textareaImages[i].length} img
                {/if}
              </span>
            </div>
          </div>
        </div>

        <!-- Separatore -->
        {#if i < textareas.length - 1}
          <div class="mt-2 flex items-center space-x-2 text-gray-500 pl-2">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14"/>
            </svg>
            <span class="text-[9px] font-medium uppercase tracking-wide">Then later</span>
            <div class="flex-1 h-px bg-gradient-to-r from-gray-700 to-transparent"></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Add button -->
  <button
    on:click={() => add(textareas.length - 1)}
    class="w-full py-2.5 border-2 border-dashed border-gray-700 hover:border-blue-600/50 rounded-lg text-xs text-gray-400 hover:text-blue-400 transition-all flex items-center justify-center space-x-2"
  >
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 5v14M5 12h14"/>
    </svg>
    <span>Add Next Step</span>
  </button>

  <InputModal
  isOpen={modalConfig.isOpen}
  title={modalConfig.title}
  icon={modalConfig.icon}
  description={modalConfig.description}
  fields={modalConfig.fields}
  on:submit={handleModalSubmit}
  on:close={handleModalClose}
/>
</div>

<style>
  .textarea-container:hover button[title="Remove step"] {
    opacity: 1;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-up {
    animation: slide-up 0.2s ease-out;
  }
</style>
