// Small helpers
const formatInitials = (firstName = '', lastName = '') => {
  const parts = [firstName.trim().charAt(0), lastName.trim().charAt(0)].filter(Boolean);
  return parts.length ? parts.join(' ') : 'VN';
};

// Helper function to show toast messages
function showToast(message, type = 'info') {
  // You can implement a toast notification here
  console.log(`[${type.toUpperCase()}] ${message}`);
}
