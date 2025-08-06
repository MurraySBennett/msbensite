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
      projectBackgroundElem.textContent = "";
      projectAnalysesElem.innerHTML = "";
      projectOutcomesElem.innerHTML = "";
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
        document.title = `${project.title} - Murray S. Bennett`;

        projectTitleElem.textContent = project.title;
        projectImageElem.src = project.image;
        projectImageElem.alt = `${project.title} Image`;
        projectImageElem.style.display = "block";

        projectSummaryElem.textContent = project.summary;
        projectBackgroundElem.textContent = project.background;

        // Clear existing list items and add new ones for analyses
        projectAnalysesElem.innerHTML = "";
        if (project.analyses && project.analyses.length > 0) {
          project.analyses.forEach((analysis) => {
            const li = document.createElement("li");
            li.textContent = analysis;
            projectAnalysesElem.appendChild(li);
          });
        } else {
          const li = document.createElement("li");
          li.textContent = "No specific analyses details provided yet.";
          projectAnalysesElem.appendChild(li);
        }

        projectOutcomesElem.textContent = project.outcomes;

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
