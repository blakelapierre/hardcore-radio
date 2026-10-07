/* Hardcore — artists panel data.
 * ARTISTS: one entry per artist or group, keyed by a short slug.
 * TRACK_ARTISTS: video ID -> artist slugs (main artist first, then featured artists).
 * To add a track: add its ID here with its artists' slugs (add a new ARTISTS entry if needed).
 * Bios are original paraphrase; sources are listed in README "Artist bio sources".
 */
window.STATION_ARTISTS = {
  artists: {
    "steve-grant": { name: "Steve Grant", bio: "Steve Grant is an independent protest rapper whose songs and videos are recorded and produced at Durty Mics Studios. His lyrics speak to the Anonymous and activist crowd, and his track here was filmed live at the 2013 Million Mask March outside the White House." },
    "poison-pen": { name: "Poison Pen", bio: "Poison Pen (Lékan Herron) is a battle MC from Bed-Stuy, Brooklyn, and a member of New York's underground Stronghold crew. He came up through the late-'90s NYC battle circuit, went on to host Da Cypha Emcee Battles, and released The Money Shot in 2009." },
    "immortal-technique": { name: "Immortal Technique", bio: "Immortal Technique (Felipe Coronel) was born in Lima, Peru, and raised in Harlem. He's a fiercely independent rapper and activist, known for the Revolutionary albums and for lyrics about politics, religion, institutional racism and government power." },
    "dr-dre": { name: "Dr. Dre", bio: "Dr. Dre (Andre Young) co-founded N.W.A, helped shape West Coast G-funk, and founded Aftermath Entertainment and Beats Electronics. Compton (2015), his first album since 2001, grew out of the Straight Outta Compton film and replaced the long-promised Detox." },
    "jill-scott": { name: "Jill Scott", bio: "Jill Scott is a singer-songwriter and actor whose 2000 debut, Who Is Jill Scott? Words and Sounds Vol. 1, went platinum. The next two volumes both went gold. On Compton she sings the hook of \"For The Love Of Money.\"" },
    "jon-connor": { name: "Jon Connor", bio: "Jon Connor (Jon Freeman Jr.) is a rapper and producer from Flint, Michigan. He built his name on mixtapes such as The People's Rapper LP and released Unconscious State in 2013. He was signed to Dr. Dre's Aftermath from 2013 to 2019 and appears on Compton." },
    "anderson-paak": { name: "Anderson .Paak", bio: "Anderson .Paak (Brandon Paak Anderson) is a rapper, singer-songwriter and producer. He made his name with the albums Venice, Malibu, Oxnard and Ventura. He won a Grammy for \"Bubblin\" and two more for Ventura and its song \"Come Home.\"" },
    "king-mez": { name: "King Mez", bio: "Mez, formerly King Mez, is a rapper, producer, songwriter and video director. He was born at Fort Campbell, Kentucky, and raised in Southeast Raleigh, North Carolina. He was one of the main writers on Dr. Dre's Compton, and he later worked on Revenge of the Dreamers III (2019)." },
    "justus": { name: "Justus", bio: "Justus (Justin Mohrle), formerly known as Love, JT, is a rapper from Garland, near Dallas. Dallas native The D.O.C. introduced him to Dr. Dre. He signed with Aftermath and appears on three Compton songs, including \"Talk About It\" and \"Deep Water.\"" },
    "the-goondox": { name: "The Goondox", bio: "The Goondox are EPMD's PMD, rapper Sean Strange and the German production team Snowgoons. Their 2012 album Welcome to the Goondox includes this posse cut. Besides Swollen Members, it features Jus Allah, Impakt, ODoub, Klee Magor, Virtuoso, Meth Mouth, Psych Ward and Jaysaun." },
    "swollen-members": { name: "Swollen Members", bio: "Swollen Members is a hip-hop group from Vancouver, made up of rappers Madchild and Prevail and producer Rob the Viking. They have released eight studio albums. Madchild and Prevail both rap on \"Raps Of The Titans.\"" },
    "k-rino": { name: "K-Rino", bio: "K-Rino is a Houston underground pioneer from the South Park neighborhood. He started rapping in 1983 and founded the South Park Coalition in 1987. He has stayed independent his whole career, releasing his music on his own Black Book International label." },
    "genocide": { name: "Genocide", bio: "Genocide (Geno) is a Bosnian-born rapper from Zvornik, based in New Zealand, who also records with the crew Debt Collectors. His albums include Classified Intelligence with producer Junior Makhno, Made in Bosnia, The Burial Ground and Death Before Dishonor (2017)." },
    "vinnie-paz": { name: "Vinnie Paz", bio: "Philadelphia rapper Vinnie Paz co-founded Jedi Mind Tricks in 1996 with producer Stoupe. In 1998 he formed the collective Army of the Pharaohs, which he still fronts. Here he guests on Genocide's \"Conspiracy Of Silence\" and opens AOTP's \"Terrorstorm.\"" },
    "tom-macdonald": { name: "Tom MacDonald", bio: "Tom MacDonald is an Edmonton-born rapper and former pro wrestler who releases all of his own music. His 2017 single \"Dear Rappers\" was his breakthrough. His political songs, which critics often call \"MAGA rap,\" have repeatedly topped digital sales charts." },
    "aesop-rock": { name: "Aesop Rock", bio: "Aesop Rock (Ian Bavitz) is a rapper and producer who led the wave of underground hip-hop in the late '90s and early 2000s. He spent years on El-P's Definitive Jux label and now records for Rhymesayers." },
    "xzibit": { name: "Xzibit", bio: "Xzibit (Alvin Joiner) is a West Coast rapper, actor and TV host who debuted on Loud Records with At the Speed of Life (1996). Kingmaker (2025) is his first solo album in 13 years, released through Conor McGregor's Greenback Records." },
    "compton-av": { name: "Compton AV", bio: "Compton AV is a newer rapper Xzibit put on Kingmaker. X says the album's title is partly about giving new talent like him a platform. He takes the opening verse of \"Shut Yo Mouth.\"" },
    "butch-cassidy": { name: "Butch Cassidy", bio: "Butch Cassidy (Danny Means II) is a singer and rapper from Long Beach, California, known for his West Coast hooks. He has worked with Nate Dogg, Snoop Dogg, Ice Cube, Warren G, DJ Quik, DJ Battlecat and Xzibit, and he sings on G-Unit's \"Groupie Love.\"" },
    "army-of-the-pharaohs": { name: "Army of the Pharaohs", bio: "Army of the Pharaohs is an underground hip-hop collective from Philadelphia, formed in 1998 by Jedi Mind Tricks' Vinnie Paz. Its changing lineup has included Celph Titled, Esoteric, Apathy, Reef the Lost Cauze and Crypt the Warchild. Heavy Lies the Crown (2014) was its fifth album." },
    "pete-and-bas": { name: "Pete & Bas", bio: "Pete & Bas are Peter Bowditch and Basil Bellgrave, two South London rappers in their seventies who went viral with \"Shut Ya Mouth\" in 2017. The BBC called them the grandfathers of UK drill. Their first album, Mugshot, came out in 2024." },
    "rage-against-the-machine": { name: "Rage Against the Machine", bio: "Rage Against the Machine formed in Los Angeles in 1991: Zack de la Rocha, Tom Morello, Tim Commerford and Brad Wilk. They fused metal, rap, punk and funk with revolutionary politics, sold more than 16 million records, and were inducted into the Rock and Roll Hall of Fame in 2023." },
    "canon": { name: "Canon", bio: "Canon (Aaron McCain) is a Christian rapper from Chicago. Lecrae mentored him and took him on tour as his hype man. He then signed with Reflection Music Group, released the Loose Canon EP in 2012, and reached the Billboard 200 with Loose Canon, Vol. 2 in 2014." },
    "g-unit": { name: "G-Unit", bio: "G-Unit is the Queens crew of 50 Cent, Lloyd Banks and Tony Yayo. Young Buck joined while Yayo was in jail. After a run of mixtapes, their 2003 debut Beg for Mercy sold more than two million copies in the US." },
  },
  tracks: {
    "dnhqZcG0tew": ["steve-grant"],
    "1yOoM7_AseY": ["poison-pen", "immortal-technique"],
    "ZbiMp6VqYYg": ["dr-dre", "jill-scott", "jon-connor", "anderson-paak"],
    "T9CHWOsGrx0": ["dr-dre", "king-mez", "justus"],
    "DiWM-f1uRQg": ["the-goondox", "swollen-members"],
    "h8Rf24KdOBw": ["k-rino"],
    "AW77gFdSALE": ["genocide", "vinnie-paz"],
    "ZP6lxNdNTQQ": ["tom-macdonald"],
    "N1iUN-J-lSs": ["aesop-rock"],
    "tauuueQvTf0": ["xzibit", "compton-av", "butch-cassidy"],
    "VMXUvaaDdwo": ["army-of-the-pharaohs"],
    "91cYRcgu548": ["pete-and-bas"],
    "kl4wkIPiTcY": ["rage-against-the-machine"],
    "sjNLqGSt7dA": ["canon"],
    "aMmkNDwnl68": ["g-unit"],
  },
};
