// Global, non-module constants (loaded early via <script> in index.html)
// Keep this file dependency-free.

window.GameConstants = {
    VERSION: '0.9.2',
    // Replace with your Google Docs URL.
    // Opens in the same window by default (no target="_blank").
    PATCH_NOTES_URL: 'https://docs.google.com/document/d/1GuhOzIMpLPJa0-1uVDG_kFpvNS1yed2C1ZipAccrtDI/edit?usp=sharing',
    
    // World dimensions (4x larger than canvas for camera follow system)
    WORLD_WIDTH: 25600,
    WORLD_HEIGHT: 14400,
};
