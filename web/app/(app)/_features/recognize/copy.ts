const places = (n: number) => (n === 1 ? "1 place" : `${n} places`);

/** Copy for saving a place into a list and for making a new list. */
export const recognizeCopy = {
  en: {
    picker: {
      title: "Save to a list",
      subPlace: (name: string) => `Pick a list for ${name}`,
      subEmpty: "Start a list, then fill it from your map.",
      count: places,
      inList: "Already in this list",
      newList: "New list",
    },
    newList: {
      title: "New list",
      name: "Title",
      namePlaceholder: "Sunday brunch",
      description: "Description",
      optional: "Optional",
      cover: "Cover",
      createAndSave: "Create and save",
      create: "Create list",
    },
  },
  tr: {
    picker: {
      title: "Bir listeye kaydet",
      subPlace: (name: string) => `${name} için bir liste seç`,
      subEmpty: "Bir liste başlat, sonra haritandan doldur.",
      count: (n: number) => `${n} mekan`,
      inList: "Zaten bu listede",
      newList: "Yeni liste",
    },
    newList: {
      title: "Yeni liste",
      name: "Başlık",
      namePlaceholder: "Pazar kahvaltısı",
      description: "Açıklama",
      optional: "İsteğe bağlı",
      cover: "Kapak",
      createAndSave: "Oluştur ve kaydet",
      create: "Listeyi oluştur",
    },
  },
};
