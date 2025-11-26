document.addEventListener("DOMContentLoaded", () => {
    // Navbar scroll effect
    const navbar = document.querySelector(".navbar");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    // Counter animation
    const counters = document.querySelectorAll(".counter");
    const speed = 200;

    function animateCounters() {
        counters.forEach((counter) => {
            const target = +counter.getAttribute("data-target") || +counter.innerText;
            const count = +counter.innerText.replace(/,/g, "");
            const increment = target / speed;

            if (count < target) {
                counter.innerText = Math.ceil(count + increment);
                setTimeout(animateCounters, 1);
            } else {
                counter.innerText = target;
            }
        });
    }

    // Initialize counters
    counters.forEach((counter) => {
        counter.innerText = "0";
    });

    // Start counter animation when in viewport
    const statsSection = document.querySelector(".stats");
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.5 }
    );

    if (statsSection) {
        observer.observe(statsSection);
    }

    // Date form submission (spécifique au template original)
    const dateForm = document.getElementById("date-form");
    const resultsSection = document.getElementById("results");
    const initialState = document.getElementById("initial-state");
    const dateSuggestions = document.getElementById("date-suggestions");

    // Exemple de données fictives (restaurants, sports, etc.)
    const activities = {
        restaurant: [
            { name: "Bella Italia", description: "Authentic Italian cuisine", pricePerPerson: 35, rating: 4.7 },
            { name: "Sushi Express", description: "Fresh Japanese sushi", pricePerPerson: 40, rating: 4.5 }
        ],
        sports: [
            { name: "Basketball Game", description: "Local team match", pricePerPerson: 45, rating: 4.5 }
        ]
        // … autres activités dans le fichier original
    };

    const activityIcons = {
        restaurant: "bi-cup-hot-fill",
        sports: "bi-trophy-fill",
        circus: "bi-stars",
        zoo: "bi-emoji-smile-fill",
        park: "bi-tree-fill",
        movie: "bi-film",
        museum: "bi-building",
        concert: "bi-music-note-beamed",
    };

    if (dateForm) {
        dateForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const budget = Number.parseFloat(document.getElementById("budget").value);
            const people = Number.parseInt(document.getElementById("people").value);
            const dateType = document.querySelector('input[name="dateType"]:checked').value;

            const selectedActivities = [];
            document.querySelectorAll(".form-check-input:checked").forEach((checkbox) => {
                if (checkbox.name !== "dateType") {
                    selectedActivities.push(checkbox.value);
                }
            });

            if (selectedActivities.length === 0) {
                alert("Please select at least one activity");
                return;
            }

            const suggestions = generateDateSuggestions(budget, people, selectedActivities, dateType);
            displayResults(suggestions);
        });
    }

    function generateDateSuggestions(budget, people, selectedActivities, dateType) {
        const suggestions = [];
        const totalBudget = budget;

        for (let i = 0; i < 3; i++) {
            const datePlan = { title: `Date Plan ${i + 1}`, totalCost: 0, activities: [], dateType };
            let remainingBudget = totalBudget;

            const shuffledActivities = [...selectedActivities].sort(() => 0.5 - Math.random());

            for (const activityType of shuffledActivities) {
                const options = activities[activityType];
                if (!options) continue;
                const affordable = options.filter((a) => a.pricePerPerson * people <= remainingBudget);
                if (affordable.length > 0) {
                    const activity = affordable[Math.floor(Math.random() * affordable.length)];
                    const cost = activity.pricePerPerson * people;
                    datePlan.activities.push({ type: activityType, ...activity, cost });
                    remainingBudget -= cost;
                    datePlan.totalCost += cost;
                }
            }

            if (datePlan.activities.length > 0) suggestions.push(datePlan);
        }
        return suggestions;
    }

    function displayResults(suggestions) {
        dateSuggestions.innerHTML = "";
        if (suggestions.length === 0) {
            dateSuggestions.innerHTML = `<div class="alert alert-warning">No suitable plans found</div>`;
        } else {
            suggestions.forEach((plan) => {
                const planElement = document.createElement("div");
                planElement.className = "date-suggestion";
                let activitiesHTML = "";
                plan.activities.forEach((activity) => {
                    activitiesHTML += `
            <div class="activity-item">
              <div class="activity-icon"><i class="${activityIcons[activity.type]}"></i></div>
              <div class="activity-details">
                <h5>${activity.name}</h5>
                <p>${activity.description}</p>
                <span class="activity-price">$${activity.cost.toFixed(2)}</span>
              </div>
            </div>`;
                });
                planElement.innerHTML = `
          <div class="date-suggestion-header">
            <h4>${plan.title}</h4>
            <p>Total Cost: $${plan.totalCost.toFixed(2)}</p>
          </div>
          <div class="date-suggestion-body">${activitiesHTML}</div>`;
                dateSuggestions.appendChild(planElement);
            });
        }
        resultsSection.classList.remove("d-none");
        initialState.classList.add("d-none");
        resultsSection.scrollIntoView({ behavior: "smooth" });
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute("href"));
            if (targetElement) {
                window.scrollTo({ top: targetElement.offsetTop - 80, behavior: "smooth" });
            }
        });
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map((el) => new bootstrap.Tooltip(el));
});
