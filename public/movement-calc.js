(function () {
  function init() {
    const total = document.getElementById("mov-total");
    const amount = document.getElementById("mov-amount");
    const price = document.getElementById("mov-price");
    if (!total || !amount || !price) return;
    function calc() {
      const t = Number.parseFloat(total.value);
      const a = Number.parseFloat(amount.value);
      if (t > 0 && a > 0)
        price.value = (t / a).toFixed(8).replace(/0+$/, "").replace(/\.$/, ".0");
    }
    total.addEventListener("input", calc);
    amount.addEventListener("input", calc);
  }
  init();
  document.body.addEventListener("htmx:afterSettle", init);
})();
