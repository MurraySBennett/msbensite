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
  const projectAnalysesElem = document.getElementById("project-analyses");
  const projectOutcomesElem = document.getElementById("project-outcomes");
  const projectLinksContainerElem = document.getElementById(
    "project-links-container"
  );
  const projectOSFLinkElem = document.getElementById("osf-link");
  const interactiveDemoLinkElem = document.getElementById(
    "interactive-demo-link"
  );
  const experimentDemoLinkElem = document.getElementById(
    "experiment-demo-link"
  );

  // Helper function to process and append content, handling HTML and images
  function appendContent(element, contentArray, noContentMessage) {
    element.innerHTML = ""; // Clear previous content

    if (contentArray && contentArray.length > 0) {
      contentArray.forEach((content) => {
        const div = document.createElement("div");
        div.innerHTML = content;

        // Find all images within the created div and apply styling
        const images = div.querySelectorAll("img");
        images.forEach((img) => {
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.display = "block";
          img.style.margin = "10px auto";
          img.style.borderRadius = "8px";
          img.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
        });

        element.appendChild(div);
      });
    } else {
      const p = document.createElement("p");
      p.textContent = noContentMessage;
      element.appendChild(p);
    }
  }

  // Function to load project details
  async function loadProjectDetails() {
    if (!projectId) {
      projectTitleElem.textContent = "Project Not Found";
      projectSummaryElem.textContent = "No project ID provided in the URL.";
      appendContent(projectBackgroundElem, null, "");
      appendContent(projectAnalysesElem, null, "");
      appendContent(projectOutcomesElem, null, "");
      projectImageElem.style.display = "none";
      projectLinksContainerElem.style.display = "none";
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
        projectImageElem.style.display = "block";

        projectSummaryElem.textContent = project.summary;

        // Use the helper function to render background, analyses, and outcomes
        appendContent(
          projectBackgroundElem,
          project.background,
          "Background coming soon."
        );
        appendContent(
          projectAnalysesElem,
          project.analyses,
          "No specific analyses details provided yet."
        );
        appendContent(
          projectOutcomesElem,
          project.outcomes,
          "Outcomes coming soon."
        );

        // Assume no links initially, then check each one
        let hasLinks = false;

        // Handle OSF link
        if (project.osf_link) {
          projectOSFLinkElem.href = project.osf_link;
          projectOSFLinkElem.style.display = "inline-block";
          hasLinks = true;
        } else {
          projectOSFLinkElem.style.display = "none";
        }

        // Handle interactive demo link
        if (project.interactive_demo_link) {
          interactiveDemoLinkElem.href = project.interactive_demo_link;
          interactiveDemoLinkElem.style.display = "inline-block";
          hasLinks = true;
        } else {
          interactiveDemoLinkElem.style.display = "none";
        }

        // Handle experiment demo link
        if (project.experiment_demo_link) {
          experimentDemoLinkElem.href = project.experiment_demo_link;
          experimentDemoLinkElem.style.display = "inline-block";
          hasLinks = true;
        } else {
          experimentDemoLinkElem.style.display = "none";
        }

        // Show/hide the entire links container based on whether any links exist
        projectLinksContainerElem.style.display = hasLinks ? "block" : "none";
      } else {
        // Project not found in JSON
        projectTitleElem.textContent = "Project Not Found";
        projectSummaryElem.textContent =
          "The requested project could not be found.";
        projectBackgroundElem.textContent = "";
        projectAnalysesElem.innerHTML = "";
        projectImageElem.style.display = "none";
        projectLinksContainerElem.style.display = "none";
      }
    } catch (error) {
      console.error("Error loading project details:", error);
      projectTitleElem.textContent = "Error Loading Project";
      projectSummaryElem.textContent =
        "There was an error loading the project details. Please try again later.";
      projectBackgroundElem.textContent = "";
      projectAnalysesElem.innerHTML = "";
      projectImageElem.style.display = "none";
      projectLinksContainerElem.style.display = "none";
    }
  }

  // Call the function to load project details when the page loads
  loadProjectDetails();
});
