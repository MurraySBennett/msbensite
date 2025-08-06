document.addEventListener("DOMContentLoaded", () => {
  // Function to get query parameters from the URL
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  // Get the project ID from the URL
  const projectId = getQueryParam("id");

  // Get references to HTML elements where content will be displayed
  const projectTitleElem = document.getElementById("project-title");
  const projectImageElem = document.getElementById("project-image");
  const projectSummaryElem = document.getElementById("project-summary");
  const projectBackgroundElem = document.getElementById("project-background");
  const projectAnalysesElem = document.getElementById("project-analyses"); // This will now contain <p> elements
  const projectOutcomesElem = document.getElementById("project-outcomes"); // This will now contain <p> elements
  const projectLinksContainerElem = document.getElementById(
    "project-links-container"
  ); // Container for links section
  const projectOSFLinkElem = document.getElementById("osf-link");
  const interactiveDemoLinkElem = document.getElementById(
    "interactive-demo-link"
  );
  const experimentDemoLinkElem = document.getElementById(
    "experiment-demo-link"
  );

  // Function to load project details
  async function loadProjectDetails() {
    if (!projectId) {
      projectTitleElem.textContent = "Project Not Found";
      projectSummaryElem.textContent = "No project ID provided in the URL.";
      projectBackgroundElem.textContent = ""; // Clear background
      projectAnalysesElem.innerHTML = ""; // Clear analyses
      projectOutcomesElem.innerHTML = ""; // Clear analyses
      projectImageElem.style.display = "none"; // Hide image
      projectLinksContainerElem.style.display = "none"; // Hide links container
      return;
    }

    try {
      // Fetch the projects data from the JSON file
      const response = await fetch("data/projects.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const projects = await response.json();

      // Find the project that matches the ID from the URL
      const project = projects.find((p) => p.id === projectId);

      if (project) {
        // Update the page title
        document.title = `${project.title} - Murray S. Bennett`;

        // Populate the HTML elements with project data
        projectTitleElem.textContent = project.title;
        projectImageElem.src = project.image;
        projectImageElem.alt = `${project.title} Image`;
        projectImageElem.style.display = "block"; // Ensure image is visible

        projectSummaryElem.textContent = project.summary;

        projectBackgroundElem.innerHTML = "";
        // projectBackgroundElem.textContent = project.background;
        if (project.background && project.background.length > 0) {
          project.background.forEach((background) => {
            const p = document.createElement("p");
            if (background.trim().startsWith("<img")) {
              p.innerHTML = background;
              const img = p.querySelector("img");
              if (img) {
                img.style.maxWidth = "100%";
                img.style.height = "auto";
                img.style.display = "block"; // Ensure it's a block element for margin
                img.style.margin = "10px auto"; // Center the image
                img.style.borderRadius = "8px"; // Match site's aesthetic
                img.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
              }
            } else {
              p.textContent = background;
            }
            projectBackgroundElem.appendChild(p);
          });
        } else {
          const p = document.createElement("p");
          p.textContent = "Background coming soon.";
          projectBackgroundElem.appendChild(p);
        }
        // Clear existing content and add new ones for analyses as paragraph tags
        projectAnalysesElem.innerHTML = ""; // Clear previous content
        if (project.analyses && project.analyses.length > 0) {
          project.analyses.forEach((analysis) => {
            const p = document.createElement("p"); // Create a <p> tag

            // Check if the analysis string starts with an image tag
            if (analysis.trim().startsWith("<img")) {
              // If it's an image tag, set innerHTML to render it
              p.innerHTML = analysis;
              // Optional: Add some basic styling to the image within the paragraph
              const img = p.querySelector("img");
              if (img) {
                img.style.maxWidth = "100%";
                img.style.height = "auto";
                img.style.display = "block"; // Ensure it's a block element for margin
                img.style.margin = "10px auto"; // Center the image
                img.style.borderRadius = "8px"; // Match site's aesthetic
                img.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
              }
            } else {
              // Otherwise, it's plain text, set textContent
              p.textContent = analysis;
            }
            projectAnalysesElem.appendChild(p);
          });
        } else {
          const p = document.createElement("p"); // Create a <p> tag for no content
          p.textContent = "No specific analyses details provided yet.";
          projectAnalysesElem.appendChild(p);
        }

        // projectOutcomesElem.textContent = project.outcomes;
        projectOutcomesElem.innerHTML = "";
        if (project.outcomes && project.outcomes.length > 0) {
          project.outcomes.forEach((outcome) => {
            const p = document.createElement("p");
            if (outcome.trim().startsWith("<img")) {
              p.innerHTML = outcome;
              const img = p.querySelector("img");
              if (img) {
                img.style.maxWidth = "100%";
                img.style.height = "auto";
                img.style.display = "block"; // Ensure it's a block element for margin
                img.style.margin = "10px auto"; // Center the image
                img.style.borderRadius = "8px"; // Match site's aesthetic
                img.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
              }
            } else {
              p.textContent = outcome;
            }
            projectOutcomesElem.appendChild(p);
          });
        } else {
          const p = document.createElement("p");
          p.textContent = "Outcomes coming soon.";
          projectOutcomesElem.appendChild(p);
        }

        // Assume no links initially, then check each one
        let hasLinks = false;

        // Handle OSF link
        if (project.osf_link) {
          projectOSFLinkElem.href = project.osf_link;
          projectOSFLinkElem.style.display = "inline-block"; // Show the button
          hasLinks = true;
        } else {
          projectOSFLinkElem.style.display = "none"; // Hide if no link
        }

        // Handle interactive demo link
        if (project.interactive_demo_link) {
          interactiveDemoLinkElem.href = project.interactive_demo_link;
          interactiveDemoLinkElem.style.display = "inline-block"; // Show the button
          hasLinks = true;
        } else {
          interactiveDemoLinkElem.style.display = "none"; // Hide if no link
        }

        // Handle experiment demo link
        if (project.experiment_demo_link) {
          experimentDemoLinkElem.href = project.experiment_demo_link;
          experimentDemoLinkElem.style.display = "inline-block"; // Show the button
          hasLinks = true;
        } else {
          experimentDemoLinkElem.style.display = "none"; // Hide if no link
        }

        // Show/hide the entire links container based on whether any links exist
        if (hasLinks) {
          projectLinksContainerElem.style.display = "block"; // Or 'flex' if you style it that way
        } else {
          projectLinksContainerElem.style.display = "none";
        }
      } else {
        // Project not found in JSON
        projectTitleElem.textContent = "Project Not Found";
        projectSummaryElem.textContent =
          "The requested project could not be found.";
        projectBackgroundElem.textContent = "";
        projectAnalysesElem.innerHTML = "";
        projectImageElem.style.display = "none";
        projectLinksContainerElem.style.display = "none"; // Hide links container
      }
    } catch (error) {
      console.error("Error loading project details:", error);
      projectTitleElem.textContent = "Error Loading Project";
      projectSummaryElem.textContent =
        "There was an error loading the project details. Please try again later.";
      projectBackgroundElem.textContent = "";
      projectAnalysesElem.innerHTML = "";
      projectImageElem.style.display = "none"; // Corrected
      projectLinksContainerElem.style.display = "none"; // Corrected
    }
  }

  // Call the function to load project details when the page loads
  loadProjectDetails();
});
