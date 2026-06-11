const products = [
  {
    id: "kit-elita",
    type: "rank",
    name: "Kit Elita",
    badge: "Ranga",
    price: 14.99,
    image: "assets/kit-elita.png",
    description: "Dobry start dla graczy, którzy chcą wejść na serwer z mocnym zestawem.",
    features: ["Zestaw startowy Elita", "Kolorowy prefix na czacie", "Dostęp do komendy /kit elita"],
  },
  {
    id: "kit-ultra-elita",
    type: "rank",
    name: "Kit Ultra Elita",
    badge: "Popularne",
    price: 19.99,
    image: "assets/kit-ultra-elita.png",
    description: "Większy pakiet bonusów i lepsze wyposażenie do codziennej gry.",
    features: ["Zestaw Ultra Elita", "Lepsze narzędzia i surowce", "Priorytet w eventach"],
  },
  {
    id: "kit-atom",
    type: "rank",
    name: "Kit Atom",
    badge: "Najlepsze",
    price: 29.99,
    image: "assets/kit-atom.png",
    description: "Topowy zestaw AtomCraft dla graczy, którzy chcą pełnego efektu premium.",
    features: ["Najmocniejszy kit Atom", "Ekskluzywny prefix", "Bonusowe klucze do skrzynek"],
  },
  {
    id: "klucz-rzadka",
    type: "key",
    name: "Klucz do rzadkiej",
    badge: "Skrzynka",
    price: 4.99,
    image: "assets/key-blue.png",
    description: "Pakiet rzadkich kluczy do szybkiego startu i codziennego otwierania skrzynek.",
    features: ["15 kluczy rzadkich", "Szansa na surowce", "Nagrody dla rozwoju bazy"],
  },
  {
    id: "klucz-epicka",
    type: "key",
    name: "Klucz do epickiej",
    badge: "Skrzynka",
    price: 9.99,
    image: "assets/key-atom.png",
    description: "Pakiet epickich kluczy z większą szansą na mocniejsze nagrody.",
    features: ["10 kluczy epickich", "Szansa na itemy premium", "Idealny do eventów"],
  },
  {
    id: "klucz-atom",
    type: "key",
    name: "Klucz do atom",
    badge: "Top",
    price: 14.99,
    image: "assets/key-purple.png",
    description: "Pakiet atomowych kluczy do najlepszej puli nagród na serwerze.",
    features: ["5 kluczy Atom", "Najlepsza pula nagród", "Szansa na wyjątkowe dropy"],
  },
];

const cart = new Map();
const rankContainer = document.querySelector("#rankProducts");
const keyContainer = document.querySelector("#keyProducts");
const cartItems = document.querySelector("#cartItems");
const cartEmpty = document.querySelector("#cartEmpty");
const cartTotal = document.querySelector("#cartTotal");
const cartCount = document.querySelector("#cartCount");
const form = document.querySelector("#orderForm");
const formMessage = document.querySelector("#formMessage");
const freeKeyForm = document.querySelector("#freeKeyForm");
const freeKeyMessage = document.querySelector("#freeKeyMessage");
const freeKeyButton = document.querySelector("#freeKeyButton");
const freeKeyCooldownKey = "atomshop-free-key-available-at";

const formatPrice = (value) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(value);

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.innerHTML = `
    <div class="product-art" aria-label="Miejsce na zdjęcie produktu">
      ${
        product.image
          ? `<img src="${product.image}" alt="Grafika produktu ${product.name}" />`
          : `<span>Miejsce na zdjęcie produktu<br>${product.name}</span>`
      }
    </div>
    <div class="product-top">
      <div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
      </div>
      <span class="badge">${product.badge}</span>
    </div>
    <ul class="features">
      ${product.features.map((feature) => `<li>${feature}</li>`).join("")}
    </ul>
    <div class="product-buy">
      <span class="price">${formatPrice(product.price)}</span>
      <button class="primary-button" type="button" data-add="${product.id}">Dodaj do koszyka</button>
    </div>
  `;
  return card;
}

function renderProducts() {
  products
    .filter((product) => product.type === "rank")
    .forEach((product) => rankContainer.append(createProductCard(product)));

  products
    .filter((product) => product.type === "key")
    .forEach((product) => keyContainer.append(createProductCard(product)));
}

function addToCart(productId) {
  const item = cart.get(productId) || { product: products.find((product) => product.id === productId), quantity: 0 };
  item.quantity += 1;
  cart.set(productId, item);
  renderCart();
}

function changeQuantity(productId, amount) {
  const item = cart.get(productId);
  if (!item) return;

  item.quantity += amount;
  if (item.quantity <= 0) {
    cart.delete(productId);
  } else {
    cart.set(productId, item);
  }

  renderCart();
}

function renderCart() {
  const items = Array.from(cart.values());
  cartItems.innerHTML = "";

  items.forEach(({ product, quantity }) => {
    const row = document.createElement("article");
    row.className = "cart-row";
    row.innerHTML = `
      <div>
        <strong>${product.name}</strong>
        <span>${formatPrice(product.price)} za sztukę</span>
      </div>
      <div class="quantity" aria-label="Ilość produktu ${product.name}">
        <button type="button" data-quantity="${product.id}" data-amount="-1" aria-label="Zmniejsz ilość">-</button>
        <output>${quantity}</output>
        <button type="button" data-quantity="${product.id}" data-amount="1" aria-label="Zwiększ ilość">+</button>
      </div>
      <button class="icon-button" type="button" data-remove="${product.id}" aria-label="Usuń produkt">x</button>
    `;
    cartItems.append(row);
  });

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  cartEmpty.hidden = items.length > 0;
  cartTotal.textContent = formatPrice(totalPrice);
  cartCount.textContent = String(totalQuantity);
}

document.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const quantityButton = event.target.closest("[data-quantity]");
  const removeButton = event.target.closest("[data-remove]");

  if (addButton) {
    addToCart(addButton.dataset.add);
    document.querySelector("#koszyk").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (quantityButton) {
    changeQuantity(quantityButton.dataset.quantity, Number(quantityButton.dataset.amount));
  }

  if (removeButton) {
    cart.delete(removeButton.dataset.remove);
    renderCart();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (cart.size === 0) {
    formMessage.className = "form-note";
    formMessage.textContent = "Dodaj najpierw produkt do koszyka.";
    return;
  }

  const data = new FormData(form);
  const nick = data.get("nick");
  const email = data.get("email");
  const payment = data.get("payment");
  const submitButton = form.querySelector("button[type='submit']");
  const items = Array.from(cart.values()).map(({ product, quantity }) => ({
    id: product.id,
    quantity,
  }));

  submitButton.disabled = true;
  submitButton.textContent = "Nadawanie produktu...";
  formMessage.className = "form-note";
  formMessage.textContent = "Przyjmuję zamówienie i przygotowuję produkt dla gracza...";

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick, email, payment, items }),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Nie udalo sie zrealizowac zamowienia.");
    }

    cart.clear();
    renderCart();
    form.reset();
    formMessage.className = "form-note success";
    formMessage.textContent = `${result.message} Numer: ${result.orderId}.`;
  } catch (error) {
    formMessage.className = "form-note";
    formMessage.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Zloz zamowienie";
  }
});

freeKeyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(freeKeyForm);
  const nick = data.get("nick");

  freeKeyButton.disabled = true;
  freeKeyButton.textContent = "Nadawanie...";
  freeKeyMessage.className = "form-note";
  freeKeyMessage.textContent = "Sprawdzam odbiór i przygotowuję darmowy klucz...";

  try {
    const response = await fetch("/api/free-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick }),
    });
    const result = await response.json();

    if (result.availableAt) {
      localStorage.setItem(freeKeyCooldownKey, String(result.availableAt));
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Nie udalo sie odebrac darmowego klucza.");
    }

    freeKeyMessage.className = "form-note success";
    freeKeyMessage.textContent = result.message;
    updateFreeKeyCooldown();
  } catch (error) {
    freeKeyMessage.className = "form-note";
    freeKeyMessage.textContent = error.message;
    updateFreeKeyCooldown();
  }
});

function updateFreeKeyCooldown() {
  const availableAt = Number(localStorage.getItem(freeKeyCooldownKey) || 0);
  const remaining = availableAt - Date.now();

  if (remaining <= 0) {
    freeKeyButton.disabled = false;
    freeKeyButton.textContent = "Odbierz";
    return;
  }

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000);

  freeKeyButton.disabled = true;
  freeKeyButton.textContent = `Dostepne za ${hours}h ${minutes}min`;
}

renderProducts();
renderCart();
updateFreeKeyCooldown();
setInterval(updateFreeKeyCooldown, 30_000);
