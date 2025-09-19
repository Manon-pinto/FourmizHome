console.log('Hello word !')

const form = document.getElementById("housingForm");
const submitter = document.querySelector(".btn-save");
const token = localStorage.getItem('fh_token');
submitter.addEventListener("click", async (event)=>{
    event.preventDefault();
    const formData = new FormData(form);
    const resultat = await apiCall(formData)
    if (resultat.message=="Ad created"){
        window.location.assign("profil.html")
    }
})


async function apiCall(donnees) {
try {
const reponse = await fetch("http://localhost:3000/api/v1/ads/create", {
    method: "POST", 
    headers: {
        "Authorization": token,
    },
    body: donnees,
});

const resultat = await reponse.json();
console.log("Réussite :", resultat);
return resultat
} catch (erreur) {
console.error("Erreur :", erreur);
}
}

