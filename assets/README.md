# Assets

Put these files in this folder and the site picks them up automatically:

| File | Used for |
| --- | --- |
| `portrait.jpg` | Your photo on the About page (portrait 4:5 works best, at least 800×1000). |
| `Kolos_Varga_Resume.pdf` | The "Download the PDF" button on the Resume page. |

Project images: add them here (e.g. `assets/projects/p1.jpg`) and, in `projects/index.html`, replace the
sketch `<svg>` inside that project's `<div class="plate">` with `<img src="../assets/projects/p1.jpg" alt="...">`.
