// Global variables
let articles = [];
let highlightArticles = [];
let originalArticles = []; // Add this line with other global variables
let savedArticles = [];
let authors = [];
let searchModal, articleModal, datePickerModal;
let latestDatePicker;
let slider;
let currentAuthor = null;
let currentPage = 1;
let currentAuthorPage = 1;
const authorsPerPage = 20;
let searchTimeout;
let currentSearchQuery = '';
let currentTab = 'home';
let masterUrl = 'https://api.codetabs.com/v1/proxy?quest=https://dailyurducolumns.com' // https://api.cors.lol/?url=  https://api.codetabs.com/v1/proxy?quest=

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    await loadAuthors();
    initializeUIElements();
    loadSavedArticles();
    applyStoredDarkModePreference();
    await Promise.all([fetchHighlights(), fetchArticles('latest')]);
}

// Load authors from JSON file
async function loadAuthors() {
    try {
        const response = await fetch('Authors.json');
        if (!response.ok) {
            throw new Error('Failed to load authors');
        }
        const authorsData = await response.json();
        authors = authorsData.authors;
        populateAuthorsList();
    } catch (error) {
        console.error('Error loading authors:', error);
        // Fallback to a small set of authors if the fetch fails
        authors = [
            "Javed Chaudhry",
            "Rauf Klasra",
            "Zahida Hina",
            "Orya Maqbool Jan"
        ];
        populateAuthorsList(1, false, null);
    }
}

// Populate the authors list in the Authors tab
function populateAuthorsList(page = 1, append = false, customList = null) {
    const authorsList = document.getElementById('authorsList');
    if (!authorsList) return;

    const authorsToShow = customList || authors;
    const start = (page - 1) * authorsPerPage;
    const end = start + authorsPerPage;
    const paginatedAuthors = authorsToShow.slice(start, end);

    if (!append) {
        authorsList.innerHTML = '';
    }
    const fragment = document.createDocumentFragment();

    paginatedAuthors.forEach(author => {
        const item = document.createElement('ion-item');
        item.setAttribute('button', 'true');
        item.setAttribute('detail', 'true');
        item.onclick = () => filterByAuthor(author);

        item.innerHTML = `
            <ion-avatar slot="start">
                <span class="material-icons" style="font-size: 32px; color: var(--ion-color-medium);">
                    account_circle
                </span>
            </ion-avatar>
            <ion-label>
                <h2>${author}</h2>
                <p>Daily Column</p>
            </ion-label>
        `;

        fragment.appendChild(item);
    });

    authorsList.appendChild(fragment);
}

// Add infinite scroll handler for authors
function handleAuthorsInfiniteScroll(event) {
    setTimeout(async () => {
        if (currentSearchQuery) {
            currentAuthorPage++;
            const filtered = authors.filter(author =>
                author.toLowerCase().includes(currentSearchQuery)
            );
            const paginated = filtered.slice(0, currentAuthorPage * authorsPerPage);
            populateAuthorsList(currentAuthorPage, true, filtered);
            if (paginated.length >= filtered.length) {
                event.target.disabled = true;
            }
        } else {
            currentAuthorPage++;
            populateAuthorsList(currentAuthorPage, true);
            const remaining = authors.length - (currentAuthorPage * authorsPerPage);
            if (remaining <= 0) {
                event.target.disabled = true;
            }
        }

        event.target.complete();
    }, 500);
}

function initializeUIElements() {
    // Initialize modal references
    articleModal = document.getElementById('articleModal');
    datePickerModal = document.querySelector('ion-modal[trigger="datePickerBtn"]');
    latestDatePicker = document.getElementById('latestDatePicker');

    // Set up event listeners
    latestDatePicker.addEventListener('ionChange', handleDateSelection);
    document.getElementById('darkModeToggle').addEventListener('ionChange', toggleDarkMode);
    document.getElementById('saveArticleBtn').addEventListener('click', toggleSaveArticle);
    document.getElementById('shareArticleBtn').addEventListener('click', shareArticle);
    document.getElementById('textSettingsModal').addEventListener('ionModalDidPresent', loadTextSettings);
    document.getElementById('textAlignment').addEventListener('ionChange', updateTextAlignment);
    document.getElementById('scrollSpeed').addEventListener('ionChange', updateScrollSpeed);
    document.getElementById('increaseFontBtn').addEventListener('click', increaseFontSize);
    document.getElementById('decreaseFontBtn').addEventListener('click', decreaseFontSize);
    document.getElementById('authorInfiniteScroll').addEventListener('ionInfinite', handleInfiniteScroll);
    document.getElementById('authorsInfiniteScroll').addEventListener('ionInfinite', handleAuthorsInfiniteScroll);
    document.getElementById('searchBtn').addEventListener('click', toggleSearch);
}

function applyStoredDarkModePreference() {
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').checked = true;
    }
}

// Date handling functions
async function handleDateSelection(event) {
    const selectedDate = event.detail.value;
    if (!selectedDate) return;
    await fetchArticles('byDate', selectedDate);
}

function showTodaysArticles() {
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    latestDatePicker.value = todayString;
    fetchArticles('byDate', todayString);
    if (datePickerModal) datePickerModal.dismiss();
}

// Unified article fetching function
async function fetchArticles(type, param = null) {
    let url = '';
    let subtitleText = '';
    let errorMessage = '';

    try {
        if (type !== 'byAuthor') {
            currentAuthor = null;
            currentPage = 1;
            articles = [];
        }

        switch (type) {
            case 'latest':
                url = masterUrl + '/LstColumns.aspx';
                subtitleText = 'Today\'s Columns';
                errorMessage = 'Failed to load latest articles';
                break;

            case 'byDate':
                const formattedDate = param.split('T')[0].replace(/-/g, '');
                url = masterUrl + `/columns/${formattedDate}`;

                let dateParts = param.includes('T') ?
                    param.split('T')[0].split('-') :
                    [param.substring(0, 4), param.substring(4, 6), param.substring(6, 8)];

                const day = dateParts[2];
                const month = dateParts[1];
                const year = dateParts[0];
                const formattedDisplayDate = `${day}-${month}-${year}`;

                subtitleText = `Columns for ${formattedDisplayDate}`;
                errorMessage = 'Failed to load articles for selected date';

                if (datePickerModal) datePickerModal.dismiss();
                break;

            case 'byAuthor':
                const authorSlug = param.toLowerCase().replace(/ /g, '-');
                if (param !== currentAuthor) {
                    currentAuthor = param;
                    currentPage = 1;
                    articles = [];
                }
                url = masterUrl + `/${authorSlug}/${currentPage}`;
                subtitleText = `Columns by ${param}`;
                errorMessage = 'Failed to filter articles by author';
                break;
        }

        const fetchedArticles = await fetchData(url);
        const append = type === 'byAuthor' && currentPage > 1;
        displayArticles(fetchedArticles, 'latestList', append);
        document.getElementById('latestSubtitle').textContent = subtitleText;
        currentPage++;

        originalArticles = [...articles]; // Add this line

        return fetchedArticles;
    } catch (error) {
        console.error(`Error fetching ${type} articles:`, error);
        document.getElementById('latestList').innerHTML = `
            <ion-item lines="none">
                <ion-label color="danger">${errorMessage}</ion-label>
            </ion-item>
        `;
        if (type === 'byDate' || type === 'byAuthor') {
            alert(errorMessage);
        }
        throw error;
    }
}

// Fetch highlights (last 6 months)
async function fetchHighlights() {
    try {
        const randomDate = generateRandomPastDate();
        const url = masterUrl + `/columns/${randomDate}`;
        const fetchedArticles = await fetchData(url);
        highlightArticles = fetchedArticles.slice(0, 12);
        displayHighlightsCarousel(highlightArticles);
    } catch (error) {
        console.error('Error fetching highlights:', error);
        document.getElementById('highlightsSlider').innerHTML = `
        <div class="tns-item">
          <ion-text color="danger">Failed to load highlights</ion-text>
        </div>
      `;
    }
}

async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const parser = new DOMParser();
    const doc = parser.parseFromString(await response.text(), 'text/html');

    return Array.from(doc.querySelectorAll('.item-list')).map(article => ({
        title: article.querySelector('.post-box-title a')?.textContent.trim() || 'N/A',
        link: article.querySelector('.post-box-title a')?.getAttribute('href') || '',
        author: article.querySelector('.post-meta-author a')?.textContent.trim() || 'N/A',
        date: article.querySelector('.tie-date')?.textContent.trim().replace('March', 'Mar') || 'N/A',
        content: null,
        id: Math.random().toString(36).substr(2, 9)
    }));
}

// Highlighted Slider
function displayHighlightsCarousel(highlightArticlesToDisplay) {
    const sliderHTML = highlightArticlesToDisplay.map(article => `
        <div class="slider-item">
            <div class="slider-card" onclick="openArticle('${article.id}')">
                <div class="slider-title">${article.title}</div>
                <div class="slider-meta">${article.author} | ${article.date}</div>
            </div>
        </div>
    `).join('');

    document.getElementById('highlightsSlider').innerHTML = sliderHTML;
    setTimeout(initSlider, 100);
}

function initSlider() {
    if (slider) {
        slider.destroy();
    }

    slider = tns({
        container: '#highlightsSlider',
        items: 1.2,
        slideBy: 1,
        gutter: 10,
        center: false,
        autoplay: true,
        autoplayTimeout: 4000,
        autoplayButtonOutput: false,
        loop: true,
        mouseDrag: true,
        controls: false,
        nav: true,
        speed: 400,
        responsive: {
            640: { items: 2.2 },
            768: { items: 3.2 }
        }
    });
}

function displayArticles(articlesToDisplay, listId, append = false) {
    const listElement = document.getElementById(listId);

    if (articlesToDisplay.length === 0) {
        listElement.innerHTML = `
            <ion-item lines="none" class="ion-text-center">
                <ion-label>No articles found</ion-label>
            </ion-item>
        `;
        return;
    }

    // Generate HTML for new articles
    const articlesHTML = articlesToDisplay.map(article => `
        <ion-item button detail="true" class="article-item" onclick="openArticle('${article.id}')">
            <ion-label>
                <h2>${article.title}</h2>
                <p>${article.author} | ${article.date}</p>
            </ion-label>
        </ion-item>
    `).join('');

    if (append) {
        listElement.insertAdjacentHTML('beforeend', articlesHTML);
    } else {
        listElement.innerHTML = articlesHTML;
    }

    if (listId !== 'highlightsSlider') {
        articles = append ? [...articles, ...articlesToDisplay] : articlesToDisplay;
    }
}

function displaySavedArticles() {
    if (savedArticles.length === 0) {
        document.getElementById('savedList').innerHTML = `
            <ion-item lines="none" class="ion-text-center">
                <ion-label>No saved articles yet</ion-label>
            </ion-item>
        `;
        return;
    }

    const savedHTML = savedArticles.map(article => `
        <ion-item button detail="true" onclick="openArticle('${article.id}')">
            <ion-label>
                <h2>${article.title}</h2>
                <p>${article.author} | ${article.date}</p>
            </ion-label>
            <ion-icon name="bookmark" slot="end" class="saved-icon"></ion-icon>
        </ion-item>
    `).join('');

    document.getElementById('savedList').innerHTML = savedHTML;
}

// Author filtering functions
async function filterArticlesByAuthor() {
    const author = document.getElementById('authorSelect').value;
    if (!author) return;

    await fetchArticles('byAuthor', author);
}

function filterByAuthor(authorName) {
    showTab('home');
    fetchArticles('byAuthor', authorName);
}

// Article handling functions
async function openArticle(articleId) {
    const article = articles.find(a => a.id === articleId) || highlightArticles.find(a => a.id === articleId);
    if (!article) return;
    setArticleModalContent(article);
    articleModal.present();

    if (!article.content) {
        try {
            await fetchArticleContent(article);
        } catch (error) {
            document.getElementById('articleDetailContent').innerHTML = `
                <ion-text color="danger">Failed to load article content. Please try again.</ion-text>
            `;
            return;
        }
    }
    document.getElementById('articleDetailContent').innerHTML = formatArticleContent(article.content);
}

function handleAuthorChipClick(author) {
    dismissArticleModal();
    showTab('home');
    filterByAuthor(author);
}

function handleDateChipClick(dateString) {
    dismissArticleModal();
    showTab('home');

    const months = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12'
    };

    const dateParts = dateString.replace(',', '').split(' ');
    let month, day, year;

    if (dateParts.length === 3) {
        [month, day, year] = dateParts;
    } else {
        console.error('Unexpected date format:', dateString);
        return;
    }

    const monthNumber = months[month];
    if (!monthNumber) {
        console.error('Unknown month:', month);
        return;
    }

    const formattedDate = `${year}${monthNumber}${day.padStart(2, '0')}`;
    fetchArticles('byDate', formattedDate);
}

function setArticleModalContent(article) {
    document.getElementById('articleDetailTitle').textContent = article.title;
    document.getElementById('articleDetailAuthor').textContent = article.author;
    document.getElementById('articleDetailDate').textContent = article.date;

    document.getElementById('articleDetailAuthor').closest('ion-chip').onclick =
        () => handleAuthorChipClick(article.author);
    document.getElementById('articleDetailDate').closest('ion-chip').onclick =
        () => handleDateChipClick(article.date);

    const isSaved = savedArticles.some(saved => saved.id === article.id);
    document.getElementById('saveArticleBtn').innerHTML = `
      <span class="material-icons">${isSaved ? 'bookmark' : 'bookmark_border'}</span>
    `;

    const savedSettings = JSON.parse(localStorage.getItem('textSettings') || '{}');
    const fontSize = savedSettings.fontSize || 16;
    const contentElement = document.getElementById('articleDetailContent');
    const alignment = savedSettings.alignment || 'right';
    contentElement.style.fontSize = `${fontSize}px`;
    contentElement.classList.remove('text-left', 'text-center', 'text-right', 'text-justify');
    contentElement.classList.add(`text-${alignment}`);
    updateFontSizeDisplay(fontSize);

    const scrollSpeed = savedSettings.scrollSpeed || 0;
    if (scrollSpeed > 0) {
        setTimeout(() => {
            updateScrollSpeed({ detail: { value: scrollSpeed } });
        }, 300);
    }

    contentElement.innerHTML = `
      <ion-skeleton-text animated style="width: 100%; height: 20px;"></ion-skeleton-text>
      <ion-skeleton-text animated style="width: 90%; height: 20px;"></ion-skeleton-text>
      <ion-skeleton-text animated style="width: 95%; height: 20px;"></ion-skeleton-text>
      <ion-skeleton-text animated style="width: 85%; height: 20px;"></ion-skeleton-text>
    `;

    if (!article.content) {
        fetchArticleContent(article)
            .then(() => {
                contentElement.innerHTML = formatArticleContent(article.content);
                if (scrollSpeed > 0) {
                    updateScrollSpeed({ detail: { value: scrollSpeed } });
                }
            })
            .catch(error => {
                contentElement.innerHTML = `
                    <ion-text color="danger">Failed to load article content. Please try again.</ion-text>
                `;
            });
    } else {
        contentElement.innerHTML = formatArticleContent(article.content);
    }
}

async function fetchArticleContent(article) {
    try {
        const response = await fetch(masterUrl + `${article.link}`);
        const parser = new DOMParser();
        const doc = parser.parseFromString(await response.text(), 'text/html');
        const paragraphs = doc.querySelectorAll('.UrduPost p, .entry.UrduPost p');

        article.content = Array.from(paragraphs)
            .map(p => p.textContent.trim())
            .filter(text => text)
            .join('\n\n');

        return article.content;
    } catch (error) {
        console.error('Error fetching article content:', error);
        throw error;
    }
}

function formatArticleContent(content) {
    if (!content) return '<p>No content available</p>';
    return content.split('\n\n').map(para => `<p>${para}</p>`).join('');
}

let autoScrollInterval = null;

function showTextSettingsModal() {
    const modal = document.getElementById('textSettingsModal');
    modal.present();
}

async function handleInfiniteScroll(event) {
    if (currentTab === 'home' && currentAuthor) {
        try {
            await fetchArticles('byAuthor', currentAuthor);
        } catch (error) {
            console.error('Error loading more articles:', error);
        }
    }
    event.target.complete();
}

function loadTextSettings() {
    const savedSettings = JSON.parse(localStorage.getItem('textSettings') || '{}');
    document.getElementById('textAlignment').value = savedSettings.alignment || 'right';
    document.getElementById('scrollSpeed').value = savedSettings.scrollSpeed || 0;

    const content = document.getElementById('articleDetailContent');
    if (content) {
        content.classList.remove('text-left', 'text-center', 'text-right', 'text-justify');
        content.classList.add(`text-${savedSettings.alignment || 'right'}`);

        if (savedSettings.scrollSpeed > 0) {
            updateScrollSpeed({ detail: { value: savedSettings.scrollSpeed } });
        }
    }
}

function updateTextAlignment(event) {
    const alignment = event.detail.value;
    const content = document.getElementById('articleDetailContent');
    content.classList.remove('text-left', 'text-center', 'text-right', 'text-justify');
    content.classList.add(`text-${alignment}`);
    saveTextSettings('alignment', alignment);
}

// Font size handling functions
function increaseFontSize() {
    const content = document.getElementById('articleDetailContent');
    let currentSize = parseInt(getComputedStyle(content).fontSize);
    const newSize = Math.min(currentSize + 2, 30);
    content.style.fontSize = `${newSize}px`;
    updateFontSizeDisplay(newSize);
    saveTextSettings('fontSize', newSize);
}

function decreaseFontSize() {
    const content = document.getElementById('articleDetailContent');
    let currentSize = parseInt(getComputedStyle(content).fontSize);
    const newSize = Math.max(currentSize - 2, 10);
    content.style.fontSize = `${newSize}px`;
    updateFontSizeDisplay(newSize);
    saveTextSettings('fontSize', newSize);
}

function updateFontSizeDisplay(size) {
    document.getElementById('currentFontSize').textContent = size;
}

function updateScrollSpeed(event) {
    const speed = event?.detail?.value ??
        JSON.parse(localStorage.getItem('textSettings'))?.scrollSpeed ??
        0;

    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }

    if (speed > 0) {
        const modalContent = document.querySelector('#articleModal ion-content');
        if (modalContent) {
            const scrollContainer = modalContent.shadowRoot?.querySelector('.inner-scroll');

            autoScrollInterval = setInterval(() => {
                if (scrollContainer) {
                    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
                    if (scrollContainer.scrollTop >= maxScroll) {
                        clearInterval(autoScrollInterval);
                        autoScrollInterval = null;
                        return;
                    }

                    scrollContainer.scrollTop += speed * 1.5;
                }
            }, 100);
        }
    }
    saveTextSettings('scrollSpeed', speed);
}

function saveTextSettings(key, value) {
    const settings = JSON.parse(localStorage.getItem('textSettings') || '{}');
    settings[key] = value;
    localStorage.setItem('textSettings', JSON.stringify(settings));
}

// Saved article management
function toggleSaveArticle() {
    const articleTitle = document.getElementById('articleDetailTitle').textContent;
    const article = articles.find(a => a.title === articleTitle);

    if (!article) return;

    const savedIndex = savedArticles.findIndex(saved => saved.id === article.id);

    if (savedIndex === -1) {
        // Save the article
        savedArticles.push(article);
        document.getElementById('saveArticleBtn').innerHTML = '<span class="material-icons">bookmark</span>';
    } else {
        // Unsave the article
        savedArticles.splice(savedIndex, 1);
        document.getElementById('saveArticleBtn').innerHTML = '<span class="material-icons">bookmark_border</span>';
    }

    localStorage.setItem('savedArticles', JSON.stringify(savedArticles));

    if (currentTab === 'saved') {
        displaySavedArticles();
    }
}

function loadSavedArticles() {
    const saved = localStorage.getItem('savedArticles');
    if (saved) {
        savedArticles = JSON.parse(saved);
    }
}

function shareArticle() {
    const articleTitle = document.getElementById('articleDetailTitle').textContent;
    const currentArticle = articles.find(a => a.title === articleTitle);

    if (navigator.share) {
        navigator.share({
            title: articleTitle,
            text: `Check out this article by ${currentArticle.author}`,
            url: masterUrl + currentArticle.link
        });
    } else {
        alert('Sharing is not supported in this browser. Copy the URL manually.');
    }
}

// UI utility functions
function toggleDarkMode(event) {
    const enabled = event.detail.checked;
    document.body.classList.toggle('dark-mode', enabled);
    localStorage.setItem('darkMode', enabled);
}

function showTab(tabName) {
    currentTab = tabName;
    const searchBar = document.getElementById('mainSearchBar');
    if (searchBar) {
        searchBar.placeholder = tabName === 'authors'
            ? 'Search Authors...'
            : 'Search Articles...';
    }
    ['home', 'authors', 'saved', 'settings'].forEach(tab => {
        document.getElementById(`${tab}Content`).style.display = 'none';
    });
    document.getElementById(`${tabName}Content`).style.display = 'block';

    const searchHeader = document.getElementById('searchHeader');
    if (searchHeader.style.display !== 'none') {
        toggleSearch();
    }

    if (tabName === 'authors') {
        currentAuthorPage = 1;
        populateAuthorsList(currentAuthorPage, false, null);
        document.getElementById('authorsInfiniteScroll').disabled = false;
    } else if (tabName === 'home' && slider) {
        slider.refresh();
    }
}

function toggleSearch() {
    const defaultHeader = document.getElementById('defaultHeader');
    const searchHeader = document.getElementById('searchHeader');
    const searchBar = document.getElementById('mainSearchBar');

    if (searchHeader.style.display === 'none') {
        defaultHeader.style.display = 'none';
        searchHeader.style.display = 'flex';
        searchBar.placeholder = currentTab === 'authors' ? 'Search Authors...' : 'Search Articles...';
        setTimeout(() => {
            searchBar.setFocus();
            searchBar.addEventListener('ionInput', handleSearchInput);
        }, 300);
    } else {
        defaultHeader.style.display = 'flex';
        searchHeader.style.display = 'none';
        searchBar.value = '';
        currentSearchQuery = '';
        currentAuthorPage = 1;
        if (currentTab === 'authors') {
            populateAuthorsList(currentAuthorPage);
            document.getElementById('authorsInfiniteScroll').disabled = false;
        } else {
            // Restore original articles without re-fetching
            articles = [...originalArticles];
            displayArticles(articles, 'latestList');
        }
        searchBar.removeEventListener('ionInput', handleSearchInput);
    }
}

function handleSearchInput(event) {
    clearTimeout(searchTimeout);
    currentSearchQuery = event.target.value.toLowerCase().trim();

    searchTimeout = setTimeout(() => {
        if (currentTab === 'authors') {
            searchAuthors(currentSearchQuery);
        } else {
            searchArticles(currentSearchQuery);
        }
    }, 500);
}

function searchAuthors(query) {
    const authorsList = document.getElementById('authorsList');
    authorsList.innerHTML = '';

    if (!query) {
        currentAuthorPage = 1;
        populateAuthorsList(currentAuthorPage);
        document.getElementById('authorsInfiniteScroll').disabled = false;
        return;
    }

    const filtered = authors.filter(author =>
        author.toLowerCase().includes(query)
    );

    const paginated = filtered.slice(0, currentAuthorPage * authorsPerPage);
    populateAuthorsList(1, false, paginated);

    document.getElementById('authorsInfiniteScroll').disabled =
        filtered.length <= (currentAuthorPage * authorsPerPage);
}

function searchArticles(query) {
    const filtered = originalArticles.filter(article => // Change from allArticles to originalArticles
        article.title.toLowerCase().includes(query) ||
        article.author.toLowerCase().includes(query)
    );
    displayArticles(filtered, 'latestList');
}

// Modal management
function dismissModal() {
    searchModal.dismiss();
}

function dismissArticleModal() {
    articleModal.dismiss();
}

function dismissDatePicker() {
    datePickerModal.dismiss();
}

// Helper functions
function generateRandomPastDate() {
    const today = new Date();
    const maxDaysBack = 180;
    const minDaysBack = 7;
    const randomDaysBack = Math.floor(Math.random() * (maxDaysBack - minDaysBack)) + minDaysBack;
    const randomDate = new Date(today);
    const year = randomDate.getFullYear();
    const month = String(randomDate.getMonth() + 1).padStart(2, '0');
    const day = String(randomDate.getDate()).padStart(2, '0');
    randomDate.setDate(today.getDate() - randomDaysBack);
    return `${year}${month}${day}`;
}