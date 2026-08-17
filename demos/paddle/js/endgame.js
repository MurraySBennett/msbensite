/* paddle-exp endgame.js */
/* All credentials/contact read from state.config.platform (set via YAML). */

      function dataCheck() {
        document.getElementById("datacheck").classList.add("visible");
        document.getElementById("canvas").style.display = "none";
        if (typeof ambigubot !== "undefined" && ambigubot) {
          document.getElementById("p2_type").style.display = "inline";
          document.getElementById("username_msg").style.display = "none";
        }
      }

      function expEnd() {
        exp_completed = true;
        pointsLink();
        dispFireworks = true;
        drawFireWorks();

        let contactHtml = "";
        if (CONTACT_EMAIL) {
          contactHtml = "Questions? Contact " + CONTACT_NAME +
            " at <a href=\"mailto:" + CONTACT_EMAIL + "\" style=\"color:var(--accent)\">" +
            CONTACT_EMAIL + "</a>.";
        } else if (CONTACT_NAME && CONTACT_NAME !== "the research team") {
          contactHtml = "Questions? Contact " + CONTACT_NAME + ".";
        }

        const bodyEl    = document.getElementById("ov-end-body");
        const actionEl  = document.getElementById("ov-end-action");
        const contactEl = document.getElementById("ov-end-contact");

        if (sona_participants) {
          if (bodyEl) bodyEl.innerHTML =
            "Thank you for your participation!<br><br>" +
            "Your participation credit is being processed.";
          if (actionEl) actionEl.innerHTML =
            "<p style=\"font-size:.8rem;color:var(--text-muted)\">You may close this window.</p>";

        } else if (prolific_participants) {
          if (bodyEl) bodyEl.innerHTML =
            "Thank you for your participation!<br><br>" +
            "Please click below to return to Prolific and receive your payment.";
          const btn = document.getElementById("exitButton");
          if (btn) {
            btn.textContent = "Return to Prolific";
            btn.onclick = function() {
              const code = PROLIFIC_CODE || "STUDY_COMPLETE";
              window.location.href = exp_completed
                ? "https://app.prolific.co/submissions/complete?cc=" + code
                : "https://app.prolific.co/submissions/";
            };
          }
          const exitForm = document.getElementById("exitForm");
          if (exitForm) exitForm.classList.add("visible");
          if (actionEl) actionEl.innerHTML =
            "<p style=\"font-size:.8rem;color:var(--text-muted)\">Use the Return button above.</p>";

        } else {
          if (bodyEl) bodyEl.innerHTML =
            "Thank you for your participation!<br><br>" +
            "Please let the researcher know you have finished.";
          if (actionEl) actionEl.innerHTML =
            "<p style=\"font-size:.8rem;color:var(--text-muted)\">You may close this window.</p>";
        }

        if (contactEl) contactEl.innerHTML = contactHtml;
        OV.show("ov-end");
      }

      function gameclosed() {
        if (fwCtx) fwCtx.clearRect(0, 0, expCanvas.width, expCanvas.height);
        const el = document.getElementById("ov-closed-contact");
        if (el) el.innerHTML = CONTACT_EMAIL
          ? "Questions? Contact " + CONTACT_NAME +
            " at <a href=\"mailto:" + CONTACT_EMAIL + "\" style=\"color:var(--accent)\">" +
            CONTACT_EMAIL + "</a>."
          : "Questions? Contact the research team.";
        OV.show("ov-closed");
      }

      var completion_request_sent = false;
      function pointsLink() {
        if (completion_request_sent || !ws || ws.readyState !== WebSocket.OPEN) return;
        completion_request_sent = true;
        ws.send(JSON.stringify({ type: 'complete' }));
      }
