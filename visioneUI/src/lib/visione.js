// imageGallery.js
import { tick } from "svelte";

export let isSidebarOpen = true;
export let contentScale = 1;
export let selectedImage = null;
export let isModalOpen = false;
export const totalImages = 40;
export const columns = 5;
export let lastViewedIndex = 0;
export let imagesContainer;

// Toggle della sidebar
export function toggleSidebar() {
    isSidebarOpen = !isSidebarOpen;
}

// Zoom
export function zoomIn() {
    contentScale = Math.min(contentScale + 0.1, 2);
}

export function zoomOut() {
    contentScale = Math.max(contentScale - 0.1, 0.5);
}

// Apertura modale
export function openModal(index) {
    selectedImage = {
        index: index,
        title: `Image ${index + 1}`,
        date: "2023-11-15",
        size: "800x600",
        resolution: "72dpi",
        tags: ["sample", "placeholder"],
    };
    lastViewedIndex = index;
    isModalOpen = true;

    tick().then(scrollToSelected);
}

// Chiusura modale
export function closeModal() {
    isModalOpen = false;
}

// Navigazione immagini
export function navigateImage(offset) {
    if (!selectedImage) return;
    let newIndex = selectedImage.index + offset;
    if (newIndex < 0) newIndex = totalImages - 1;
    if (newIndex >= totalImages) newIndex = 0;
    openModal(newIndex);
}

// Scroll verso l'immagine selezionata
export function scrollToSelected() {
    if (selectedImage) {
        const imgElement = document.querySelector(
            `[data-index="${selectedImage.index}"]`,
        );
        if (imgElement) {
            imgElement.scrollIntoView({ block: "center", behavior: "smooth" });
        }
    }
}

// Scroll alla posizione dell'immagine nella griglia
export function scrollToImage(index) {
    if (!imagesContainer) return;

    const imageElement = imagesContainer.querySelector(
        `[data-index="${index}"]`,
    );
    if (imageElement) {
        const containerRect = imagesContainer.getBoundingClientRect();
        const elementRect = imageElement.getBoundingClientRect();
        const scrollPosition =
            imageElement.offsetTop - containerRect.height / 2 + elementRect.height / 2;

        imagesContainer.scrollTo({ top: scrollPosition, behavior: "smooth" });
    }
}
