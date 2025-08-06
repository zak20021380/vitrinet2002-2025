// Dynamically set active state on mobile nav based on current page
window.addEventListener('DOMContentLoaded', function() {
  var current = window.location.pathname.split('/').pop() || 'index.html';
  var items = document.querySelectorAll('.mobile-nav .nav-item');
  items.forEach(function(item) {
    if (item.getAttribute('href') === current) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
});
