export { formatDate, generateColors };

function formatDate(dateString) {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}


// A new helper function to generate an array of random, colorful RGBA strings
function generateColors(numColors) {
    const colors = [];
    for (let i = 0; i < numColors; i++) {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        colors.push(`rgba(${r}, ${g}, ${b}, 0.7)`); // 0.7 opacity for a nice look
    }
    return colors;
}