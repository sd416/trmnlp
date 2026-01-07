const trmnlp = {};

trmnlp.connectLiveRender = function () {
  const ws = new WebSocket("/live_reload");

  ws.onopen = function () {
    console.log("Connected to live reload socket");
  };

  ws.onmessage = function (msg) {
    const payload = JSON.parse(msg.data);

    if (payload.type === "reload") {
      trmnlp.fetchPreview();
      trmnlp.userData.textContent = JSON.stringify(payload.user_data, null, 2);
      hljs.highlightAll();
    }
  };

  ws.onclose = function () {
    console.log("Reconnecting to live reload socket...");
    setTimeout(trmnlp.connectLiveRender, 1000);
  };
};


trmnlp.fetchPreview = function (pickerState) {
  const screenClasses = (pickerState?.screenClasses || trmnlp.picker.state.screenClasses).join(" ");
  const encodedScreenClasses = encodeURIComponent(screenClasses);
  let src = `/render/${trmnlp.view}.${trmnlp.formatSelect.value}?screen_classes=${encodedScreenClasses}`;

  // Get state for PNG parameters (needed for both preview and size calculation)
  const state = pickerState || trmnlp.picker.state;
  const width = encodeURIComponent(state.width);
  const height = encodeURIComponent(state.height);
  const grays = state.palette.grays || 2;
  const colorDepth = Math.ceil(Math.log2(grays));

  // If requesting a PNG, also include dimensions, dark mode, and color depth
  if (trmnlp.formatSelect.value === 'png') {
    src += `&width=${width}&height=${height}&color_depth=${colorDepth}`;
  }

  trmnlp.spinner.style.display = "inline-block";
  trmnlp.iframe.src = src;

  // Set loading state for both payload size indicators
  trmnlp.setPayloadLoading('html');
  trmnlp.setPayloadLoading('png');

  // Fetch both HTML and PNG sizes in a single request
  const sizeUrl = `/render/${trmnlp.view}.size?screen_classes=${encodedScreenClasses}&width=${width}&height=${height}&color_depth=${colorDepth}`;
  
  fetch(sizeUrl)
    .then(res => res.json())
    .then(data => {
      trmnlp.updatePayloadSize('html', data.html_size);
      trmnlp.updatePayloadSize('png', data.png_size);
    })
    .catch(err => {
      console.error('Failed to fetch payload sizes:', err);
    });
};

trmnlp.setPayloadLoading = function(format) {
  const container = document.querySelector(`[data-payload-size="${format}"]`);
  if (container) {
    container.classList.add('payload-size--loading');
  }
};

trmnlp.updatePayloadSize = function(format, bytes) {
  const container = document.querySelector(`[data-payload-size="${format}"]`);
  if (!container) return;
  
  const valueEl = container.querySelector('[data-payload-value]');
  
  // Remove loading and existing color classes
  container.classList.remove(
    'payload-size--loading',
    'payload-size--green',
    'payload-size--yellow',
    'payload-size--red'
  );
  
  // Calculate and apply color class based on thresholds:
  // < 75KB = green, 75-99KB = yellow, 100KB+ = red
  const kb = bytes / 1024;
  let colorClass;
  if (kb < 75) {
    colorClass = 'green';
  } else if (kb < 100) {
    colorClass = 'yellow';
  } else {
    colorClass = 'red';
  }
  
  container.classList.add(`payload-size--${colorClass}`);
  valueEl.textContent = `${kb.toFixed(1)} KB`;
};

document.addEventListener("DOMContentLoaded", async function () {
  trmnlp.view = document.querySelector("meta[name='trmnl-view']").content;
  trmnlp.iframe = document.querySelector("iframe");
  trmnlp.formatSelect = document.querySelector(".select-format");
  trmnlp.userData = document.getElementById("user-data");
  trmnlp.spinner = document.querySelector(".spinner");
  trmnlp.isLiveReloadEnabled =
    document.querySelector("meta[name='live-reload']").content === "true";

  if (trmnlp.isLiveReloadEnabled) {
    trmnlp.connectLiveRender();
  }

  const formatValue = localStorage.getItem("trmnlp-format") || "html";

  trmnlp.formatSelect.value = formatValue;
  trmnlp.formatSelect.addEventListener("change", () => {
    localStorage.setItem("trmnlp-format", trmnlp.formatSelect.value);
    trmnlp.fetchPreview();
  });

  trmnlp.iframe.addEventListener("load", () => {
    trmnlp.spinner.style.display = "none";
  });

  document.getElementById('picker-form').addEventListener('trmnl:change', (event) => {
    trmnlp.iframe.style.width = `${event.detail.width}px`;
    trmnlp.iframe.style.height = `${event.detail.height}px`;

    trmnlp.fetchPreview(event.detail);
  });

  trmnlp.picker = await TRMNLPicker.create('picker-form', { localStorageKey: 'trmnlp-picker' });
});
