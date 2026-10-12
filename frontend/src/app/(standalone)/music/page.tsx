'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
const source = 'KENDALL 030 Terminology Quiz Study Guide Fall 26; Medieval Music 1–2; Renaissance Music 1 (local course packet, verified September 21).';
type Term={name:string;definition:string;cue:string;question:string;options:string[];answer:number;prompt:string;rubric:string[];model:string;source?:string;supplemental?:boolean};
const terms:Term[] = [
 {name:'Monophony', definition:'One melodic line, performed by one person or by several people together in unison.', cue:'Follow the tune. More singers do not necessarily mean more independent lines.', question:'A choir sings the same melody together. Which texture is this?', options:['Monophony','Polyphony','Strophic'], answer:0, prompt:'Why can a whole choir still produce monophony?', rubric:['Identify one melodic line.','Explain that unison performers share that line.'], model:'The singers all perform the same melody in unison, so there is one melodic line. The number of performers does not determine the texture.'},
 {name:'Polyphony', definition:'Two or more simultaneous melodic lines that are independent and comparably important.', cue:'Follow one line while another continues with a different melody.', question:'Several independent melodies sound together. Which texture fits?', options:['Drone','Polyphony','Register'], answer:1, prompt:'What would you listen for to distinguish polyphony from unison?', rubric:['Identify multiple simultaneous lines.','Describe their melodic independence.'], model:'I would listen for distinct melodies happening at the same time. In unison, all performers share one melody instead.'},
 {name:'Drone', definition:'A sustained pitch, group of pitches, or chord beneath other musical activity.', cue:'Listen below the changing melody for a sound that remains held.', question:'A changing melody sounds above a held low pitch. What is the held sound?', options:['Melisma','Strophe','Drone'], answer:2, prompt:'Why does a drone alone not establish polyphony?', rubric:['Describe a held background sound.','Distinguish it from an independent active melody.'], model:'A drone sustains a background pitch while the melody changes. That held sound is not itself a separate independent melody.'},
 {name:'Register', definition:'The relative pitch range in which a voice or instrument sounds: low, middle, or high.', cue:'Describe where the sound sits in pitch, rather than how loud it is.', question:'A singer moves from low pitches to high pitches. What has changed?', options:['Register','Language','Strophic form'], answer:0, prompt:'Explain the difference between high register and loud volume.', rubric:['Relate register to pitch range.','Relate loudness to volume rather than pitch.'], model:'High register means a high pitch range. A sound can be high and quiet, or low and loud, because volume is a separate property.'},
 {name:'Melisma', definition:'Several notes sung on one syllable.', cue:'Track a syllable while the singer moves through multiple pitches.', question:'A singer stretches one syllable across eight notes. What is this?', options:['Syllabic setting','Melisma','Unison'], answer:1, prompt:'What evidence would support calling a passage melismatic?', rubric:['Identify a single syllable.','Describe multiple notes on that syllable.'], model:'I would hear one syllable continue across several changing notes. A long note alone would not demonstrate melisma.'},
 {name:'Syllabic', definition:'A text setting with primarily one note per syllable.', cue:'Check the relationship between text syllables and notes, not the speed.', question:'Most syllables receive one note. Which description fits?', options:['Drone','Melismatic','Syllabic'], answer:2, prompt:'Can a syllabic passage be slow? Explain.', rubric:['State that tempo is independent of text setting.','Describe one note per syllable.'], model:'Yes. Syllabic describes the use of mostly one note per syllable, so those notes can be sung slowly or quickly.'},
 {name:'Strophic', definition:'The same music returns for successive verses or stanzas.', cue:'Compare whole verses. A repeated short motif alone does not show strophic form.', question:'Each new verse uses the same tune. What form is this?', options:['Strophic','Polyphonic','Melismatic'], answer:0, prompt:'Why is a repeated short motif not sufficient evidence of strophic form?', rubric:['Describe repetition across verses or stanzas.','Distinguish that from a repeated small musical idea.'], model:'Strophic form requires the same music to return for successive verses. A short motif can repeat inside many different forms.'},
];


const renaissance='Kendall, Renaissance Music 2, pages 1–2 (assigned course handout).';
const classical='Kendall, Classical Music 1 F. 21, page 1 (assigned course handout).';
terms.push(
 {name:'Homophony',definition:'A texture in which a main melody has accompaniment, or voices move together in a chordal rhythm.',cue:'Ask whether lines move independently or share a coordinated rhythm and foreground melody.',question:'Voices sing different pitches together in the same rhythm. Which description fits?',options:['Chordal homophony','Unison monophony','Melisma'],answer:0,prompt:'How does chordal homophony differ from unison?',rubric:['Identify different simultaneous pitches in chordal texture.','Contrast with one shared melody in unison.'],model:'In chordal homophony, voices sing different pitches while moving together rhythmically. In unison, they share the same melody.',source:'Kendall, Renaissance Music 1, page 1; Classical Music 1, page 1.',supplemental:true},
 {name:'Imitation',definition:'One voice presents a musical idea that another voice enters with later.',cue:'Follow the opening phrase and listen for it returning in another voice or register.',question:'A phrase begins in one voice, then a second voice enters with similar material. What technique is this?',options:['Strophic form','Imitation','Drone'],answer:1,prompt:'Why is a later entrance with related material evidence of imitation?',rubric:['Identify a shared musical idea.','Describe successive entries in separate voices.'],model:'The second voice takes up an idea already introduced by the first. The related phrases enter successively rather than starting together.',source:'Kendall, Renaissance Music 1, page 1 (Josquin opening).',supplemental:true},
 {name:'Dissonance',definition:'A combination of simultaneous pitches heard as tension or a clash in the musical context.',cue:'Hear how the clash changes and whether it settles into a more stable sound.',question:'The handout connects intensified clashes in O Mirtillo with which expressive purpose?',options:['Removing all emotion','Proving the singer is loud','Emphasizing the text’s cruelty'],answer:2,prompt:'Explain how dissonance can contribute to text expression in a madrigal.',rubric:['Identify an audible clash or tension.','Connect that musical effect to the text’s emotion.'],model:'Clashing pitches can intensify an emotionally charged word or phrase. In O Mirtillo, the handout connects increased dissonance and lengthened notes to the idea of cruelty.',source:renaissance,supplemental:true},
 {name:'Cadence',definition:'A musical gesture that gives a phrase or section a sense of closure.',cue:'Listen at the end of a phrase for a pause, arrival, or settling of harmony.',question:'Which term describes a gesture that closes a musical phrase?',options:['Cadence','Register','Timbre'],answer:0,prompt:'Why should you listen at phrase endings when looking for cadences?',rubric:['Connect a cadence to closure.','Locate that closure at a phrase or section ending.'],model:'A cadence marks a sense of arrival or closure. Phrase endings are where those closing gestures often shape how complete or unresolved the music feels.',source:renaissance,supplemental:true},
 {name:'Monody',definition:'A prominent solo vocal melody with a subordinate instrumental accompaniment.',cue:'Track which line carries the words and whether the accompaniment supports it.',question:'A solo singer carries the main text above a supporting instrumental part. Which term fits?',options:['Four-part organum','Monody','Unaccompanied unison'],answer:1,prompt:'Explain why monody and monophony are different terms.',rubric:['Describe monody as a solo vocal melody with accompaniment.','Describe monophony as one melodic line.'],model:'Monody places a prominent solo vocal melody over supporting accompaniment. Monophony describes a single melodic line, so the terms do not mean the same thing.',source:renaissance+' Caccini is reference-only in the September 22 module.',supplemental:true},
 {name:'Figured bass',definition:'A bass line with figures that guide the performer in supplying the harmony.',cue:'This is a notation term; a short recording alone does not prove what was written on the page.',question:'Figures above a bass note tell a performer how to fill out the harmony. What is this notation?',options:['A libretto','A cadenza','Figured bass'],answer:2,prompt:'What can you explain about figured bass without pretending to see a score in an audio excerpt?',rubric:['Identify bass notes plus figures as notation.','Explain their role in guiding accompanying harmony.'],model:'Figured bass is a notated bass line with figures guiding the accompanying harmony. Audio may let me hear accompaniment, but it does not show whether figures were written in the score.',source:renaissance,supplemental:true},
 {name:'Basso continuo',definition:'A continuing bass foundation with accompanying harmony, commonly realized by players in Baroque music.',cue:'Listen for the bass foundation and harmonic support; identify instruments only when the excerpt supports it.',question:'Which role is closely associated with realizing harmony from figured bass?',options:['Basso continuo','Strophic verse text','High register'],answer:0,prompt:'How are figured bass and basso continuo related?',rubric:['Identify figured bass as notational guidance.','Identify continuo as the performed bass and harmonic support.'],model:'Figured bass guides how the harmony is supplied above a bass line. Basso continuo refers to the continuing bass and harmonic accompaniment realized in performance.',source:renaissance,supplemental:true},
 {name:'Solo concerto',definition:'A work that places a solo instrument in interaction with an orchestra.',cue:'Compare moments when the soloist leads, the orchestra leads, and they play together.',question:'A violin soloist alternates and interacts with an orchestra. Which genre fits the course handout?',options:['Motet','Concerto','Plainchant'],answer:1,prompt:'Give two things to listen for in the relationship between soloist and orchestra.',rubric:['Describe a soloist-orchestra interaction.','Give a second distinct interaction or change of role.'],model:'I would notice when the soloist carries the melody with orchestral support. I would also listen for the orchestra taking over the main material or answering the soloist.',source:classical,supplemental:true},
 {name:'Cadenza',definition:'A featured solo passage that can sound improvisatory and display the performer’s skill.',cue:'Listen for the orchestra withdrawing while the soloist becomes especially exposed.',question:'The orchestra stops and the soloist plays an improvisatory-sounding display. What is the passage called?',options:['Drone','Motet','Cadenza'],answer:2,prompt:'What audible evidence can suggest a cadenza, without assuming it was improvised?',rubric:['Describe an exposed solo display.','Avoid claiming actual improvisation from sound alone.'],model:'An exposed virtuosic solo while the orchestra withdraws can suggest a cadenza. It may sound improvisatory even when the performer uses a written passage.',source:classical,supplemental:true},
 {name:'Virtuosity',definition:'Exceptional performing skill, often displayed through technically demanding passages.',cue:'Listen for demanding speed, range, agility, or control, and describe the particular skill you hear.',question:'A solo passage is written to display exceptional technical skill. What does it foreground?',options:['Virtuosity','One-note text setting','A repeated verse'],answer:0,prompt:'Give a specific musical observation that could support a claim of virtuosity.',rubric:['Identify a technically demanding feature.','Relate it to exceptional performing skill.'],model:'A rapid, agile passage spanning a large range could display virtuosity. I would describe the demanding playing rather than merely saying the music sounds impressive.',source:classical,supplemental:true},
 {name:'Galant style',definition:'An ideal of elegance and balance, with clear phrases, harmonies and often a melody supported by accompaniment.',cue:'Listen for compact question-and-answer phrases and clear changes in mood.',question:'Which feature best matches the handout’s galant ideal?',options:['Only a sustained drone','Balanced question-and-answer phrases','No melody or phrase boundaries'],answer:1,prompt:'Name two features that can support a galant-style description.',rubric:['Identify balanced or clear phrases.','Identify clear harmony or melody-with-accompaniment texture.'],model:'Balanced question-and-answer phrases can support that description. Clear harmonies and a main melody supported by accompaniment are further evidence.',source:classical,supplemental:true}
);

terms.push(...[
  {
    "name": "Meter",
    "definition": "The grouping of recurring beats, often in twos (duple) or threes (triple).",
    "cue": "Tap the beat, then find the recurring strong-beat grouping.",
    "question": "Which observation establishes duple meter?",
    "options": [
      "Beats group in twos",
      "There are two singers",
      "All notes are fast"
    ],
    "answer": 0,
    "prompt": "Why do fast notes not necessarily change the meter?",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "Fast notes can subdivide the same underlying beat. Meter concerns how those beats group, rather than how many notes occur within each beat.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Major and minor",
    "definition": "Modes distinguished by tonal relationships; mood alone does not determine mode.",
    "cue": "Listen to tonal relationships and the home-key framework.",
    "question": "Which inference is unsafe?",
    "options": [
      "Sad music must always be minor",
      "A major piece can contain minor inflections",
      "Tempo and mode are different properties"
    ],
    "answer": 0,
    "prompt": "Why should you avoid identifying minor mode from sadness alone?",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "Mood is an interpretation, while mode concerns tonal structure. A major-mode passage can feel sad, so I would support the mode claim with musical evidence.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Sonata form",
    "definition": "A large-scale design with exposition, development and recapitulation, often including an introduction or coda.",
    "cue": "Compare the presentation, transformation and return of principal material.",
    "question": "Which sequence describes its core sections?",
    "options": [
      "Exposition, development, recapitulation",
      "Verse, verse, verse",
      "Drone, melisma, register"
    ],
    "answer": 0,
    "prompt": "Explain the three core sections in 1–2 sentences.",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "The exposition presents principal themes and tonal contrasts. Development transforms that material, and recapitulation returns the themes within the home-key framework.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Exposition",
    "definition": "The section presenting principal thematic material and its tonal contrasts.",
    "cue": "Recognize a first subject, transition and contrasting second subject.",
    "question": "An exposition primarily…",
    "options": [
      "Presents principal material",
      "Eliminates all themes",
      "Names instruments"
    ],
    "answer": 0,
    "prompt": "How is an exposition different from a development?",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "The exposition establishes principal material and contrasts. Development works on that earlier material through transformation, fragmentation or changes of key.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Development",
    "definition": "A section transforming earlier thematic material, often through fragmentation, recombination and modulation.",
    "cue": "Compare short motives with the longer themes heard earlier.",
    "question": "Which is strongest evidence of development?",
    "options": [
      "Earlier motifs transformed through changing keys",
      "Any loud passage",
      "A singer breathing"
    ],
    "answer": 0,
    "prompt": "Why is loudness alone insufficient to identify development?",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "Loudness can occur in any section. Identifying development requires relationships to earlier material and its transformation, rather than volume alone.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Recapitulation",
    "definition": "The return of principal thematic material within the home-key framework after development.",
    "cue": "Compare the returning themes and their tonal setting with the exposition.",
    "question": "Recapitulation involves…",
    "options": [
      "Return of principal themes",
      "Any repeated syllable",
      "Only a solo cadenza"
    ],
    "answer": 0,
    "prompt": "Why does one repeated motif not prove recapitulation?",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "A motif can recur throughout the movement. Recapitulation concerns the larger return of principal themes and their home-key setting.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Concertino and ripieno",
    "definition": "In concerto grosso, the concertino is the smaller solo group and the ripieno is the larger accompanying ensemble.",
    "cue": "Compare foreground solo lines with fuller ensemble passages.",
    "question": "Bach’s concertino here is…",
    "options": [
      "Flute, violin and harpsichord",
      "Trumpet and timpani",
      "Solo piano"
    ],
    "answer": 0,
    "prompt": "Name Bach’s concertino and explain ripieno.",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "Flute, violin and harpsichord form Bach’s concertino. The ripieno is the larger string ensemble, with the harpsichord also participating in continuo support.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Symphony",
    "definition": "A multi-movement orchestral genre; only Beethoven’s first movement is assigned for this exam.",
    "cue": "Listen for orchestral groups and thematic argument without a concerto soloist.",
    "question": "Which assigned work is a symphony?",
    "options": [
      "Beethoven no. 5",
      "Lagrime mie",
      "Era l’anima mia"
    ],
    "answer": 0,
    "prompt": "Distinguish symphony from solo concerto.",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "A symphony is an orchestral genre. A solo concerto centers a principal solo instrument in relation to the orchestra.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Motif",
    "definition": "A compact, recognizable musical idea that can be repeated and transformed.",
    "cue": "Follow a short rhythmic identity across different pitches or instruments.",
    "question": "A motif is best described as…",
    "options": [
      "A compact musical idea",
      "Always a complete movement",
      "An instrument family"
    ],
    "answer": 0,
    "prompt": "Explain how Beethoven’s opening rhythm can unify the movement.",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "The three-short, one-long rhythm remains identifiable in changing pitches and orchestral contexts. Its recurrence connects contrasting sections.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  },
  {
    "name": "Cantata / lament",
    "definition": "A cantata is a vocal work with instrumental accompaniment; a lament expresses grief. Lagrime mie is a secular cantata and lament.",
    "cue": "Compare solo vocal expression with supporting accompaniment.",
    "question": "Lagrime mie is identified as…",
    "options": [
      "A secular cantata / lament",
      "An instrumental symphony",
      "Sacred monophonic chant"
    ],
    "answer": 0,
    "prompt": "Describe its genre and forces.",
    "rubric": [
      "Use the concept accurately.",
      "Support the distinction with a specific musical relationship."
    ],
    "model": "Lagrime mie is a secular cantata expressing lament. A soprano carries the text with instrumental accompaniment, rather than an unaccompanied choir.",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3; Classical Music 4; October 8 lecture draft (corroboration)",
    "supplemental": true
  }
]);
terms.push(
{name:'Word painting',definition:'A musical gesture expresses the meaning of particular words or images in the text.',cue:'Use the supplied text and translation to connect meaning with pitch, texture, rhythm or harmony.',question:'Which claim demonstrates word painting?',options:['A gesture matches a specific textual image','Every high note is automatically word painting','The singers use Italian'],answer:0,prompt:'What evidence must accompany a word-painting claim?',rubric:['Identify a specific textual meaning.','Connect it to an audible musical gesture.'],model:'I would identify a word or image in the supplied text and explain how a musical change expresses it. A dissonance alone does not establish that relationship.',source:'Exam guide p. 1; Renaissance Music 2 pp. 1–2; Baroque Music 2 pp. 1–4',supplemental:true},
{name:'Through-composed',definition:'Successive text sections receive changing music rather than repeating the same complete music for every stanza.',cue:'Compare sections across the work; a local repeated motif can still occur.',question:'Which distinguishes through-composed from strophic?',options:['Changing music for successive sections','Always louder music','Exactly one singer'],answer:0,prompt:'Why does local repetition not necessarily make a work strophic?',rubric:['Distinguish a recurring gesture from repeated music for whole stanzas.','Recognize the larger scale of the formal claim.'],model:'A motif can recur within a through-composed work. Strophic form requires successive stanzas to use the same music, a larger-scale pattern than one repeated gesture.',source:'Exam guide p. 1; Renaissance Music 2; Baroque Music 2',supplemental:true});

const media=[
  {
    "id": "era",
    "work": "Monteverdi, Era l’anima mia (1605)",
    "youtubeId": "FlVQdmGLJR8",
    "publisher": "La Venexiana – Topic / NAXOS of America",
    "period": "Late Renaissance / early Baroque",
    "source": "Renaissance Music 2 pages 1–2",
    "rights": "Official label-supplied YouTube stream; alternate performance"
  },
  {
    "id": "lagrime",
    "work": "Strozzi, Lagrime mie (1659)",
    "youtubeId": "1z2xtmkqaAs",
    "publisher": "Orchestra of the Age of Enlightenment",
    "period": "Baroque",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 2 pp. 1–4",
    "rights": "Original ensemble channel performance; supplementary performance"
  },
  {
    "id": "bach",
    "work": "Bach, Brandenburg Concerto no. 5: I. Allegro (1721)",
    "youtubeId": "LHjbRMIIhuM",
    "publisher": "Netherlands Bach Society",
    "period": "Baroque",
    "source": "Listening Exam Study Guide pp. 1–2; Baroque Music 3 pp. 1–2",
    "officialSource": "https://www.bachvereniging.nl/en/bwv/bwv-1050",
    "rights": "Original ensemble channel performance; BWV 1050, not earlier 1050a"
  },
  {
    "id": "mozart-concerto",
    "work": "Mozart, Piano Concerto no. 20 in D minor, K. 466: I. Allegro (1785)",
    "youtubeId": "VSfnid4FNzc",
    "publisher": "hr-Sinfonieorchester · Emanuel Ax / David Afkham",
    "period": "Classical",
    "source": "Listening Exam Study Guide pp. 1–2; Classical Music 1",
    "rights": "Official orchestra performance; alternate to the assigned Seong-Jin Cho recording. First movement begins 0:31 and ends 15:10."
  },
  {
    "id": "beethoven",
    "work": "Beethoven, Symphony no. 5 in C minor: I. Allegro con brio (1808)",
    "youtubeId": "n3EiRynr1Us",
    "publisher": "Boston Philharmonic · Benjamin Zander",
    "period": "Classical",
    "source": "Listening Exam Study Guide pp. 1–2; Classical Music 4",
    "rights": "Official orchestra first-movement performance; alternate to the handout’s LSO / Haitink recording. Handout timings do not transfer exactly."
  }
];
const exercises=[
  {
    "id": "exam-era-01",
    "mediaId": "era",
    "startSeconds": 0,
    "endSeconds": 45,
    "title": "Vocal texture",
    "focus": "texture",
    "mcq": {
      "prompt": "What distinguishes polyphony from homophony?",
      "options": [
        "Independent simultaneous melodies",
        "A melody with supporting harmony",
        "One unison line"
      ],
      "correctIndex": 0,
      "explanation": "Polyphony involves independent simultaneous lines; chordal support beneath a dominant melody is homophony."
    },
    "short": {
      "prompt": "Describe whether the voices move together or independently in this passage.",
      "criteria": [
        "Use a texture term accurately.",
        "Describe the relationship between two audible parts; allow changes within the excerpt."
      ],
      "sampleAnswer": "I would compare the voice entrances and rhythmic movement. Independent lines suggest polyphony, while shared chordal movement supports homophony."
    },
    "courseSource": "Renaissance Music 2 pp. 1–2; exam guide p. 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-era-02",
    "mediaId": "era",
    "startSeconds": 45,
    "endSeconds": 95,
    "title": "Pitch and register",
    "focus": "register",
    "mcq": {
      "prompt": "Which observation describes register?",
      "options": [
        "The volume becomes louder",
        "The words are Italian",
        "The voices move into a higher pitch range"
      ],
      "correctIndex": 2,
      "explanation": "Register is pitch range, not volume or language."
    },
    "short": {
      "prompt": "Describe a contrast in vocal register without equating it with volume.",
      "criteria": [
        "Name a relative pitch range.",
        "Keep pitch separate from loudness."
      ],
      "sampleAnswer": "A higher vocal line occupies a higher register than a low voice, even if it is quieter. I would support that comparison with a particular entrance."
    },
    "courseSource": "Renaissance Music 2 pp. 1–2; terminology quiz",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-era-03",
    "mediaId": "era",
    "startSeconds": 95,
    "endSeconds": 150,
    "title": "Text and expression",
    "focus": "word painting",
    "mcq": {
      "prompt": "What evidence best supports word painting?",
      "options": [
        "Every passage is loud",
        "There are many singers",
        "A musical gesture relates to the meaning of particular words"
      ],
      "correctIndex": 2,
      "explanation": "Word painting connects musical detail to text meaning; dissonance or high notes alone do not prove it."
    },
    "short": {
      "prompt": "How would you justify word painting here if given the text and translation?",
      "criteria": [
        "Identify a specific meaning in the text.",
        "Connect that meaning to an audible gesture; do not invent a translation."
      ],
      "sampleAnswer": "I would connect a particular word or image with a change in pitch, texture or harmony. Without the text I can describe the gesture, but cannot establish its exact meaning."
    },
    "courseSource": "Renaissance Music 2 pp. 1–2; exam guide p. 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-era-04",
    "mediaId": "era",
    "startSeconds": 150,
    "endSeconds": 210,
    "title": "Genre and large-scale form",
    "focus": "madrigal / through-composed",
    "mcq": {
      "prompt": "Which combination identifies this work?",
      "options": [
        "Sacred chant / strophic",
        "Secular madrigal / through-composed",
        "Instrumental symphony / sonata"
      ],
      "correctIndex": 1,
      "explanation": "The guide identifies Era as a secular madrigal with changing music following the text."
    },
    "short": {
      "prompt": "Explain why one repeated figure does not establish strophic form.",
      "criteria": [
        "Define strophic repetition across stanzas.",
        "Distinguish local repetition from the work’s through-composed setting."
      ],
      "sampleAnswer": "Strophic form repeats the same music for successive stanzas. A recurring gesture within Era does not change its through-composed treatment of the text."
    },
    "courseSource": "Exam guide p. 1; Renaissance Music 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-lagrime-05",
    "mediaId": "lagrime",
    "startSeconds": 0,
    "endSeconds": 45,
    "title": "Voice and accompaniment",
    "focus": "homophony / continuo",
    "mcq": {
      "prompt": "The main performing forces in this cantata are…",
      "options": [
        "Piano and full Classical orchestra",
        "Solo soprano and accompaniment",
        "Unaccompanied mixed choir"
      ],
      "correctIndex": 1,
      "explanation": "The course guide identifies soprano plus instruments; this alternative performance uses theorbo accompaniment."
    },
    "short": {
      "prompt": "Describe how the singer and accompaniment have different roles.",
      "criteria": [
        "Identify the solo vocal line.",
        "Describe accompaniment as support, not an equal choir of voices."
      ],
      "sampleAnswer": "The soprano carries the text and primary melodic line. The plucked accompaniment supplies harmonic support beneath it."
    },
    "courseSource": "Baroque Music 2 pp. 1–2; official OAE performance",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-lagrime-06",
    "mediaId": "lagrime",
    "startSeconds": 50,
    "endSeconds": 110,
    "title": "Syllables and notes",
    "focus": "melisma / syllabic",
    "mcq": {
      "prompt": "What must you hear before identifying a melisma?",
      "options": [
        "One loud high note",
        "A change of instrument",
        "One syllable across multiple notes"
      ],
      "correctIndex": 2,
      "explanation": "Count notes on the same syllable, rather than merely measuring length or volume."
    },
    "short": {
      "prompt": "Choose a vocal gesture and explain how to test whether it is melismatic or syllabic.",
      "criteria": [
        "Relate notes to syllables.",
        "Do not treat every sustained note as a melisma."
      ],
      "sampleAnswer": "If a syllable continues while the pitch changes through several notes, it is melismatic. Mostly one note for each syllable is syllabic setting."
    },
    "courseSource": "Terminology quiz; Baroque Music 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-lagrime-07",
    "mediaId": "lagrime",
    "startSeconds": 130,
    "endSeconds": 185,
    "title": "Pulse and lament",
    "focus": "meter / expression",
    "mcq": {
      "prompt": "Which is a useful way to discuss pulse?",
      "options": [
        "Compare the stability of recurring beats",
        "Assume all sad music has no meter",
        "Count the number of singers"
      ],
      "correctIndex": 0,
      "explanation": "A lament’s expression does not automatically determine its meter; listen for recurring accents and flexibility."
    },
    "short": {
      "prompt": "Describe the sense of pulse and how it affects the vocal delivery.",
      "criteria": [
        "Give audible evidence for steady or flexible pulse.",
        "Avoid deriving meter from mood alone."
      ],
      "sampleAnswer": "I would listen for repeated accents and compare the singer’s pacing with the accompaniment. A flexible delivery can heighten the lament without proving that the entire work is unmetered."
    },
    "courseSource": "Baroque Music 2 pp. 1–2; exam guide p. 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-lagrime-08",
    "mediaId": "lagrime",
    "startSeconds": 205,
    "endSeconds": 263,
    "title": "Cantata and changing sections",
    "focus": "cantata / through-composed",
    "mcq": {
      "prompt": "What is the guide’s genre for Lagrime mie?",
      "options": [
        "Concerto grosso",
        "Symphony",
        "Secular cantata / lament"
      ],
      "correctIndex": 2,
      "explanation": "This vocal lament changes its musical treatment across the text rather than simply repeating a tune for every stanza."
    },
    "short": {
      "prompt": "Explain what evidence across the whole work would support through-composed form.",
      "criteria": [
        "Compare musical treatment of successive text sections.",
        "Recognize that one short excerpt cannot prove the complete form."
      ],
      "sampleAnswer": "I would compare successive sections for new melodic and expressive material. The guide calls the work through-composed; one excerpt alone cannot demonstrate every section."
    },
    "courseSource": "Baroque Music 2 pp. 1–4; exam guide p. 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Official track/performance identifies the required vocal work; all windows fit its observed duration. Not evidence of every local expressive cue."
  },
  {
    "id": "exam-bach-09",
    "mediaId": "bach",
    "startSeconds": 15,
    "endSeconds": 80,
    "title": "Solo group and ensemble",
    "focus": "concerto grosso",
    "mcq": {
      "prompt": "Which solo group is the concertino?",
      "options": [
        "Trumpet, timpani and horn",
        "Solo piano alone",
        "Flute, violin and harpsichord"
      ],
      "correctIndex": 2,
      "explanation": "The concertino is flute, violin and harpsichord; the larger accompanying ensemble is the ripieno."
    },
    "short": {
      "prompt": "Explain how a concerto grosso creates contrast between groups.",
      "criteria": [
        "Name the three concertino instruments.",
        "Contrast their role with the ripieno."
      ],
      "sampleAnswer": "The flute, violin and harpsichord form the concertino. Their prominence contrasts with the fuller sound of the ripieno ensemble."
    },
    "courseSource": "Baroque Music 3 pp. 1–2; exam guide p. 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Netherlands Bach Society official video chapters: I Allegro 0:00; II Adagio 10:12; III Allegro 15:10. All windows end before 10:12."
  },
  {
    "id": "exam-bach-10",
    "mediaId": "bach",
    "startSeconds": 150,
    "endSeconds": 210,
    "title": "Instrument families",
    "focus": "timbre",
    "mcq": {
      "prompt": "Which family classification is correct?",
      "options": [
        "Flute is a woodwind; violin is a string instrument",
        "Flute is brass; violin is percussion",
        "Both are brass"
      ],
      "correctIndex": 0,
      "explanation": "Timbre concerns tone quality; pitch alone does not identify an instrument family."
    },
    "short": {
      "prompt": "Describe how you would distinguish flute from violin in a shared register.",
      "criteria": [
        "Use tone quality or articulation.",
        "Do not use high pitch as the sole evidence."
      ],
      "sampleAnswer": "I would compare the flute’s wind tone with the violin’s bowed articulation. Both can play high notes, so register alone does not identify either instrument."
    },
    "courseSource": "Baroque Music 3 pp. 1–2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Netherlands Bach Society official video chapters: I Allegro 0:00; II Adagio 10:12; III Allegro 15:10. All windows end before 10:12."
  },
  {
    "id": "exam-bach-11",
    "mediaId": "bach",
    "startSeconds": 280,
    "endSeconds": 350,
    "title": "Keyboard’s two roles",
    "focus": "continuo",
    "mcq": {
      "prompt": "What is special about the harpsichord’s role in this concerto?",
      "options": [
        "It replaces every string part",
        "It can support continuo and become a soloist",
        "It only plays percussion effects"
      ],
      "correctIndex": 1,
      "explanation": "The harpsichord crosses supporting and solo roles; cello and violone support the bass line."
    },
    "short": {
      "prompt": "Explain how the same instrument can function as continuo and soloist.",
      "criteria": [
        "Distinguish harmonic support from foreground virtuosity.",
        "Identify harpsichord as the instrument crossing roles."
      ],
      "sampleAnswer": "The harpsichord can supply harmonies over the bass as continuo, then move into a prominent, elaborate solo line. Its role changes even though its timbre remains recognizable."
    },
    "courseSource": "Baroque Music 3 pp. 1–2; Bach Society BWV 1050 notes",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Netherlands Bach Society official video chapters: I Allegro 0:00; II Adagio 10:12; III Allegro 15:10. All windows end before 10:12."
  },
  {
    "id": "exam-bach-12",
    "mediaId": "bach",
    "startSeconds": 420,
    "endSeconds": 480,
    "title": "Virtuosity and meter",
    "focus": "duple meter / virtuosity",
    "mcq": {
      "prompt": "Which claim is stated by the exam guide for this movement?",
      "options": [
        "Romantic symphony in triple meter",
        "Unmetered sacred chant",
        "Baroque concerto grosso in duple meter"
      ],
      "correctIndex": 2,
      "explanation": "The guide identifies duple meter and virtuoso solo writing; fast notes are subdivisions of beats, not automatically a new meter."
    },
    "short": {
      "prompt": "Describe an instrumental display without confusing note speed with meter.",
      "criteria": [
        "Identify elaborate or rapid solo writing.",
        "Distinguish beat grouping from subdivisions."
      ],
      "sampleAnswer": "Rapid keyboard or melodic figures can demonstrate virtuosity. I would feel the underlying duple beat grouping separately from those faster notes."
    },
    "courseSource": "Exam guide p. 2; Baroque Music 3",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Netherlands Bach Society official video chapters: I Allegro 0:00; II Adagio 10:12; III Allegro 15:10. All windows end before 10:12."
  },
  {
    "id": "exam-mozart-concerto-13",
    "mediaId": "mozart-concerto",
    "startSeconds": 40,
    "endSeconds": 100,
    "title": "Solo concerto: performing forces",
    "focus": "solo concerto",
    "mcq": {
      "prompt": "Which genre best identifies this work?",
      "options": [
        "Solo piano concerto",
        "Concerto grosso for three soloists",
        "Unaccompanied madrigal"
      ],
      "correctIndex": 0,
      "explanation": "A solo piano concerto sets an individual piano soloist in relation to an orchestra. A passage need not include both forces at every moment."
    },
    "short": {
      "prompt": "Describe which forces are audible, then distinguish that observation from the work’s solo-concerto genre.",
      "criteria": [
        "Identify orchestral forces.",
        "Distinguish solo concerto genre from whether piano is audible at this exact moment."
      ],
      "sampleAnswer": "I would identify whether the passage features only orchestra or also the piano. The work is a piano concerto even when a particular passage gives the orchestra prominence."
    },
    "courseSource": "Exam guide p. 2; Classical Music 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "hr-Sinfonieorchester official video chapters: I Allegro 0:31; II Romance 15:10; III Allegro assai 23:26. All windows are within 0:31–15:10."
  },
  {
    "id": "exam-mozart-concerto-14",
    "mediaId": "mozart-concerto",
    "startSeconds": 210,
    "endSeconds": 270,
    "title": "Piano and orchestra",
    "focus": "solo / ensemble",
    "mcq": {
      "prompt": "What distinguishes this work from Bach’s assigned concerto?",
      "options": [
        "It is a vocal lament",
        "One principal piano soloist instead of a three-instrument concertino",
        "No orchestra ever plays"
      ],
      "correctIndex": 1,
      "explanation": "Compare instrumental roles, not merely the number of people visible on stage."
    },
    "short": {
      "prompt": "Compare the solo role here with the concertino in Brandenburg no. 5.",
      "criteria": [
        "Identify solo piano against orchestra.",
        "Name Bach’s flute, violin and harpsichord solo group."
      ],
      "sampleAnswer": "Mozart centers a solo piano against the orchestra. Bach distributes solo prominence among flute, violin and harpsichord in a concertino."
    },
    "courseSource": "Exam guide p. 2; Baroque Music 3; Classical Music 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "hr-Sinfonieorchester official video chapters: I Allegro 0:31; II Romance 15:10; III Allegro assai 23:26. All windows are within 0:31–15:10."
  },
  {
    "id": "exam-mozart-concerto-15",
    "mediaId": "mozart-concerto",
    "startSeconds": 500,
    "endSeconds": 560,
    "title": "Sonata as an argument",
    "focus": "sonata form",
    "mcq": {
      "prompt": "What describes a development section?",
      "options": [
        "The entire piece must become louder",
        "A new vocal text stanza begins",
        "Earlier material is transformed, fragmented or moved through keys"
      ],
      "correctIndex": 2,
      "explanation": "Development transforms earlier themes; exposition presents material and recapitulation returns it in the home-key framework."
    },
    "short": {
      "prompt": "Explain how you would test a proposed development passage by comparing it with the opening.",
      "criteria": [
        "Look for transformation of earlier material.",
        "Use comparison; do not identify formal location from loudness alone."
      ],
      "sampleAnswer": "I would compare its motifs with the opening and listen for changes in key, fragmentation or recombination. Those relationships are stronger evidence than a louder dynamic by itself."
    },
    "courseSource": "Exam guide pp. 1–2; October 8 lecture draft 26:54–30:51 (corroboration)",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "hr-Sinfonieorchester official video chapters: I Allegro 0:31; II Romance 15:10; III Allegro assai 23:26. All windows are within 0:31–15:10."
  },
  {
    "id": "exam-mozart-concerto-16",
    "mediaId": "mozart-concerto",
    "startSeconds": 760,
    "endSeconds": 840,
    "title": "Cadenza and authorship",
    "focus": "cadenza",
    "mcq": {
      "prompt": "What is a cadenza?",
      "options": [
        "An elaborate solo passage often near a movement’s close",
        "A repeated vocal stanza",
        "A held bass drone in every piece"
      ],
      "correctIndex": 0,
      "explanation": "A cadenza foregrounds solo virtuosity. This alternative recording’s cadenza author is not established; do not transfer the assigned recording’s Beethoven attribution."
    },
    "short": {
      "prompt": "Explain how a cadenza differs from routine accompaniment.",
      "criteria": [
        "Describe exposed solo display.",
        "Avoid claiming spontaneous improvisation or an unverified author."
      ],
      "sampleAnswer": "A cadenza foregrounds the soloist in an elaborate display, rather than supporting another melody. A performance may use a composed cadenza, so I would not assume it is improvised."
    },
    "courseSource": "Exam guide p. 2; Classical Music 1; official hr recording",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "hr-Sinfonieorchester official video chapters: I Allegro 0:31; II Romance 15:10; III Allegro assai 23:26. All windows are within 0:31–15:10."
  },
  {
    "id": "exam-beethoven-17",
    "mediaId": "beethoven",
    "startSeconds": 0,
    "endSeconds": 45,
    "title": "A four-note idea",
    "focus": "motif / rhythm",
    "mcq": {
      "prompt": "Which description fits the famous opening motif?",
      "options": [
        "A repeated bass drone",
        "Three short notes followed by a longer note",
        "A solo vocal stanza"
      ],
      "correctIndex": 1,
      "explanation": "The compact rhythmic idea recurs and is transformed throughout the movement; a motif is smaller than an entire theme."
    },
    "short": {
      "prompt": "Explain how a compact motif can help unify a longer movement.",
      "criteria": [
        "Describe repeated rhythmic identity.",
        "Explain transformation or recurrence across sections."
      ],
      "sampleAnswer": "The three-short, one-long rhythm remains recognizable when its pitches, instruments or context change. That recurring identity connects different parts of the movement."
    },
    "courseSource": "Classical Music 4 p. 1; exam guide p. 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Boston Philharmonic official upload explicitly identifies first movement; all windows fit its observed 403.541-second duration."
  },
  {
    "id": "exam-beethoven-18",
    "mediaId": "beethoven",
    "startSeconds": 45,
    "endSeconds": 100,
    "title": "Orchestral contrasts",
    "focus": "texture / instrumentation",
    "mcq": {
      "prompt": "Which performing force identifies a symphony?",
      "options": [
        "Solo soprano and theorbo",
        "Unaccompanied mixed voices",
        "Orchestra"
      ],
      "correctIndex": 2,
      "explanation": "This instrumental orchestral work contrasts groups and textures; a symphony does not require a concerto soloist."
    },
    "short": {
      "prompt": "Describe one orchestral contrast and explain its effect.",
      "criteria": [
        "Identify instrument groups or texture change from listening.",
        "Relate the change to energy, contrast or emphasis."
      ],
      "sampleAnswer": "I would compare a full ensemble statement with a lighter or more lyrical response. The changing orchestral weight can make the same rhythmic material feel more forceful or restrained."
    },
    "courseSource": "Classical Music 4 pp. 1–2; exam guide p. 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Boston Philharmonic official upload explicitly identifies first movement; all windows fit its observed 403.541-second duration."
  },
  {
    "id": "exam-beethoven-19",
    "mediaId": "beethoven",
    "startSeconds": 160,
    "endSeconds": 215,
    "title": "Themes and return",
    "focus": "exposition / recapitulation",
    "mcq": {
      "prompt": "How does recapitulation differ from development?",
      "options": [
        "It returns principal themes within the home-key framework",
        "It must introduce a singer",
        "It means any literal repeated note"
      ],
      "correctIndex": 0,
      "explanation": "The handout maps exposition, development and recapitulation; exact timings belong to its LSO / Haitink recording."
    },
    "short": {
      "prompt": "Explain what you would compare to identify a recapitulation in this alternative performance.",
      "criteria": [
        "Compare returning principal themes with their exposition.",
        "Consider tonal return; do not borrow another recording’s timestamps."
      ],
      "sampleAnswer": "I would recognize the return of principal thematic material and examine its home-key setting. An isolated repeated motif alone would not establish the recapitulation."
    },
    "courseSource": "Classical Music 4 p. 2; exam guide p. 1",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Boston Philharmonic official upload explicitly identifies first movement; all windows fit its observed 403.541-second duration."
  },
  {
    "id": "exam-beethoven-20",
    "mediaId": "beethoven",
    "startSeconds": 300,
    "endSeconds": 365,
    "title": "Mode and the symphony’s arc",
    "focus": "major / minor",
    "mcq": {
      "prompt": "Which statement avoids a common mistake?",
      "options": [
        "Fast music is always major",
        "The first movement is in C minor; the whole symphony’s later ending supplies the C-major triumph",
        "The first movement necessarily ends in C major"
      ],
      "correctIndex": 1,
      "explanation": "The handout’s tragedy-to-triumph narrative concerns the whole symphony. The assigned first movement closes in C minor."
    },
    "short": {
      "prompt": "Explain the difference between the first movement’s mode and the whole symphony’s narrative.",
      "criteria": [
        "Identify the first movement’s C-minor framework.",
        "Place the major triumph in the later whole-symphony ending."
      ],
      "sampleAnswer": "The assigned first movement is rooted in C minor and closes in that mode. The eventual C-major triumph belongs to the larger symphony, so I would not describe this movement’s ending as that triumph."
    },
    "courseSource": "Classical Music 4 p. 1; exam guide p. 2",
    "examStatus": "in-posted-five-work-guide",
    "timingStatus": "practice-window; formal-location-claims-require-comparison",
    "playbackStatus": "Mini Chrome embedded player: unmuted, playing, readyState 4, seek start observed, duration bounds passed",
    "cueVerification": "Concept traced to guide/handout; exact audible local cue not independently assessed. No exact formal-section label assigned to this window.",
    "movementBoundaryEvidence": "Boston Philharmonic official upload explicitly identifies first movement; all windows fit its observed 403.541-second duration."
  }
];

interface Player{playVideo():void;pauseVideo():void;seekTo(s:number,allow:boolean):void;getCurrentTime():number;getDuration():number;getPlayerState():number;destroy():void;loadVideoById(p:{videoId:string;startSeconds:number;endSeconds:number}):void;}
interface Youtube{Player:new(el:HTMLElement,p:{host:string;videoId:string;width:string;height:string;playerVars:Record<string,string|number>;events:{onReady:(e:{target:Player})=>void;onStateChange:(e:{data:number})=>void;onError:(e:{data:number})=>void}})=>Player}
declare global{interface Window{YT?:Youtube;onYouTubeIframeAPIReady?:()=>void;}}
let youtubePromise:Promise<Youtube>|undefined;
function loadYoutube(){if(window.YT?.Player)return Promise.resolve(window.YT);if(!youtubePromise)youtubePromise=new Promise<Youtube>((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();if(window.YT)resolve(window.YT);};const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.onerror=()=>{youtubePromise=undefined;reject(new Error('Player API unavailable'));};document.head.appendChild(tag);});return youtubePromise;}
const clock=(s:number)=>`${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
type Exercise=typeof exercises[number];
function ExcerptPlayer({item,videoId}:{item:Exercise;videoId:string}){
 const host=useRef<HTMLDivElement>(null);const player=useRef<Player|null>(null);const [loaded,setLoaded]=useState(false);const [ready,setReady]=useState(false);const [status,setStatus]=useState('Player not loaded');const [time,setTime]=useState(item.startSeconds);const [duration,setDuration]=useState(0);
 useEffect(()=>{if(!loaded)return;let disposed=false;let interval:ReturnType<typeof setInterval>|undefined;
  loadYoutube().then(yt=>{if(disposed||!host.current)return;const div=document.createElement('div');host.current.replaceChildren(div);const p=new yt.Player(div,{host:'https://www.youtube-nocookie.com',videoId,width:'100%',height:'240',playerVars:{playsinline:1,origin:location.origin,start:item.startSeconds,controls:1,rel:0},events:{onReady:e=>{if(disposed)return;player.current=e.target;setReady(true);setStatus('Ready');interval=setInterval(()=>{if(disposed)return;const current=e.target.getCurrentTime();setTime(current);setDuration(e.target.getDuration());if(current>=item.endSeconds&&e.target.getPlayerState()===1)e.target.pauseVideo();},250);},onStateChange:e=>{if(!disposed)setStatus(({1:'Playing',2:'Paused',3:'Buffering',0:'Ended',5:'Cued'} as Record<number,string>)[e.data]||'Loading');},onError:e=>{if(!disposed){setReady(false);setStatus(`Playback unavailable (YouTube ${e.data}). Use the source link.`);}}}});player.current=p;
  }).catch(()=>{if(!disposed)setStatus('Player could not load. Use the source link.');});return()=>{disposed=true;clearInterval(interval);player.current?.destroy();player.current=null;};
 },[loaded,item.startSeconds,item.endSeconds,videoId]);
 const play=()=>{player.current?.loadVideoById({videoId,startSeconds:item.startSeconds,endSeconds:item.endSeconds});};
 return <div className="listening-player"><p className="backend">The external player can show its own title or artwork. This preview cannot promise fully blind listening. Audio streaming needs internet; questions and rubrics work offline.</p>{!loaded&&<button onClick={()=>setLoaded(true)}>Load official player</button>}<div ref={host}/><div className="player-buttons"><button disabled={!ready} onClick={play}>Play excerpt / replay</button><button disabled={!ready} onClick={()=>player.current?.pauseVideo()}>Pause</button><button disabled={!ready} onClick={()=>{player.current?.seekTo(item.startSeconds,true);setTime(item.startSeconds)}}>Return to start</button></div><label className="backend">Seek within practice excerpt<input aria-label="Seek within practice excerpt" type="range" min={item.startSeconds} max={Math.min(item.endSeconds,duration||item.endSeconds)} step="1" value={Math.min(Math.max(time,item.startSeconds),item.endSeconds)} disabled={!ready} onChange={e=>{const value=Number(e.target.value);player.current?.seekTo(value,true);setTime(value)}}/></label><p role="status">{status} · {clock(time)} / {clock(duration)} · Practice {clock(item.startSeconds)}–{clock(item.endSeconds)}</p><a href={`https://www.youtube.com/watch?v=${videoId}&t=${item.startSeconds}s`} target="_blank" rel="noopener noreferrer">Open official source at {clock(item.startSeconds)} ↗</a></div>
}
type ListeningProgress=Record<string,{choice?:number;answer?:string;reviewed?:boolean}>;
const PROGRESS_KEY='music-listening-draft-v1';let memoryProgress='{}';
function progressSnapshot(){try{return localStorage.getItem(PROGRESS_KEY)||memoryProgress;}catch{return memoryProgress;}}
function subscribeProgress(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener('music-listening-progress',notify);return()=>{window.removeEventListener('storage',notify);window.removeEventListener('music-listening-progress',notify);};}
function readProgress(s:string):ListeningProgress{try{const p=JSON.parse(s);if(p&&typeof p==='object'&&!Array.isArray(p))return p;}catch{}return {};}
function persistProgress(itemId:string,patch:ListeningProgress[string]){const current=readProgress(progressSnapshot());memoryProgress=JSON.stringify({...current,[itemId]:{...current[itemId],...patch}});try{localStorage.setItem(PROGRESS_KEY,memoryProgress);}catch{}window.dispatchEvent(new Event('music-listening-progress'));}
function Listening(){const [index,setIndex]=useState(0);const [revealed,setRevealed]=useState(false);const savedProgress=useSyncExternalStore(subscribeProgress,progressSnapshot,()=> '{}');const progress=readProgress(savedProgress);const [review,setReview]=useState(false);const [filter,setFilter]=useState('All');const item=exercises[index];const track=media.find(m=>m.id===item.mediaId)!;const choice=progress[item.id]?.choice;const answer=progress[item.id]?.answer||'';
 const choose=(i:number)=>{setIndex(i);setRevealed(false);setReview(false)};
 return <section className="listening"><p className="notice">20 short drills across all five works in the posted exam guide. Each explores a different listening dimension. These alternate recordings are practice sources; exact form boundaries vary by performance.</p><p className="backend">{exercises.filter(x=>progress[x.id]?.reviewed).length} / {exercises.length} listening rubrics reviewed</p><label>Period filter <select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Late Renaissance / early Baroque','Baroque','Classical'].map(v=><option key={v}>{v}</option>)}</select></label><div className="workspace"><aside aria-label="Listening candidates">{exercises.map((x,i)=>({x,i,m:media.find(m=>m.id===x.mediaId)!})).filter(({m})=>filter==='All'||m.period===filter).map(({x,i})=><button key={x.id} aria-pressed={index===i} onClick={()=>choose(i)}>{String(i+1).padStart(2,'0')} · {revealed||index!==i?x.focus:'Listen first'}</button>)}</aside><article><p className="eyebrow">DRILL {String(index+1).padStart(2,'0')} / EXAM REPERTOIRE</p><h2>{revealed?item.title:'Listen, then describe.'}</h2>{revealed&&<p>{track.work} · {track.period}<br/>{track.publisher}</p>}<ExcerptPlayer key={item.id} item={item} videoId={track.youtubeId}/><button onClick={()=>setRevealed(!revealed)}>{revealed?'Hide app hints':'Reveal work and focus'}</button>{revealed&&<><fieldset><legend>{item.mcq.prompt}</legend>{item.mcq.options.map((v,i)=><label key={v}><input type="radio" name={item.id} checked={choice===i} onChange={()=>persistProgress(item.id,{choice:i})}/>{v}</label>)}</fieldset>{choice!==undefined&&<p className="feedback">{choice===item.mcq.correctIndex?'Correct.':'Revisit the concept.'} {item.mcq.explanation}</p>}<label htmlFor="listening-answer" className="short">{item.short.prompt}<small>Answer in 1–2 sentences.</small></label><textarea id="listening-answer" maxLength={1000} value={answer} onChange={e=>persistProgress(item.id,{answer:e.target.value})}/><button className="primary" onClick={()=>{setReview(true);persistProgress(item.id,{reviewed:true})}}>Open self-review rubric</button><p className="backend">AI grading is not connected. Answers and review progress are saved locally in this browser when storage is available.</p>{review&&<div className="rubric"><ul>{item.short.criteria.map(c=><li key={c}>{c}</li>)}</ul><p><strong>Concept model:</strong> {item.short.sampleAnswer}</p><p>This model teaches the listening test or a sourced property of the work. It is not an independently audited transcription of this exact window.</p><p>Use only claims that this actual excerpt supports. Concept questions can describe the whole work; identify exact formal sections by comparison, not by borrowed timings.</p></div>}</>}<footer>Course source: {revealed?item.courseSource:'Reveal the work after listening to see its source notes.'}<br/>Stream: {revealed?track.rights:'Official performer or label stream. Reveal for performance details.'}<br/>Exam scope: verified against the posted October 15 listening guide.</footer></article></div></section>
}

const works=[
 ['Monteverdi · Era l’anima mia · 1605','Late Renaissance / early Baroque · Secular madrigal','Mixed voices; homophonic and polyphonic writing; through-composed text setting. Connect changes of register, texture and dissonance with the supplied text before claiming word painting.'],
 ['Strozzi · Lagrime mie · 1659','Baroque · Secular cantata / lament','Solo soprano with instrumental accompaniment; homophonic texture and continuo. Compare changing vocal delivery, pulse and text setting across the through-composed lament.'],
 ['Bach · Brandenburg Concerto no. 5 · I · 1721','Baroque · Concerto grosso','Duple meter and major-mode framework. Flute, violin and harpsichord form the concertino; ripieno strings supply the larger group. The harpsichord crosses continuo and virtuoso solo roles.'],
 ['Mozart · Piano Concerto no. 20 in D minor · I · 1785','Classical · Solo concerto','Solo piano and orchestra; sonata principles and contrasting themes; prominent woodwinds and virtuosic solo writing. A cadenza spotlights the soloist. The assigned Cho recording uses Beethoven’s cadenza; this alternative recording’s cadenza author is unverified.'],
 ['Beethoven · Symphony no. 5 in C minor · I · 1808','Classical · Symphony','Orchestral sonata form; recurring three-short, one-long motif; strong contrasts and transformations. The recapitulation includes an oboe solo absent from the exposition. This movement ends in C minor; the C-major triumph belongs to the later ending of the whole symphony.']
];
function Guide(){const [draft,setDraft]=useState('');const [loaded,setLoaded]=useState(false);const [remaining,setRemaining]=useState(1200);const [deadline,setDeadline]=useState<number|null>(null);
const running=deadline!==null&&remaining>0;
function saveTimer(left:number,end:number|null){setRemaining(left);setDeadline(end);try{localStorage.setItem('music-practice-timer',JSON.stringify({left,end}))}catch{}}
function toggleTimer(){if(deadline!==null){saveTimer(Math.max(0,Math.ceil((deadline-Date.now())/1000)),null);}else{saveTimer(remaining,Date.now()+remaining*1000)}}
useEffect(()=>{const timer=setTimeout(()=>{try{setDraft(localStorage.getItem('music-response-plan')||'');const timer=JSON.parse(localStorage.getItem('music-practice-timer')||'null');if(timer&&Number.isFinite(timer.left)&&(timer.end===null||Number.isFinite(timer.end))){setDeadline(timer.end);setRemaining(timer.end===null?Math.max(0,timer.left):Math.max(0,Math.ceil((timer.end-Date.now())/1000)));}}catch{}setLoaded(true);},0);return()=>clearTimeout(timer)},[]);
useEffect(()=>{if(loaded)try{localStorage.setItem('music-response-plan',draft)}catch{}},[draft,loaded]);
useEffect(()=>{if(deadline===null)return;const timer=setInterval(()=>setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000))),250);return()=>clearInterval(timer)},[deadline]);
const words=draft.trim()?draft.trim().split(/\s+/).length:0;
return <><article className="panel"><p className="eyebrow">THE ACTUAL EXAM</p><h2>Listen, identify, substantiate.</h2><p>CourseWorks opens Thursday, October 15 at 2:40 p.m. and closes Friday, October 16 at 2:40 p.m. New York time (EDT). In Japan that is October 16 at 3:40 a.m. through October 17 at 3:40 a.m. JST. The posted guide permits a convenient start within that window; any individual accommodation still needs instructor confirmation.</p><p>Once started: 60 minutes, three excerpts of 2–3 minutes, a 200–225-word response for each. Allow about 20 minutes per question. Replay remains available and texts/translations are supplied where needed. Each response is worth five points; the instructor rewards insightful detail and accurate terminology.</p><p>The short 1–2-sentence drills build skills. They do not replace the longer exam responses.</p></article><article className="panel"><h2>Know these five sound worlds.</h2>{works.map(([name,identity,note])=><div className="scope" key={name}><h3>{name}</h3><p><strong>{identity}</strong></p><p>{note}</p></div>)}</article><article className="panel"><h2>Build a response from audible evidence.</h2><ol><li>Identify work, composer, period and genre.</li><li>Describe voices or instruments and their roles, then texture.</li><li>Describe pulse/meter, major/minor framework and a distinctive rhythmic or melodic gesture. Avoid assuming that mood determines mode.</li><li>For vocal music, connect the supplied words to text setting or expression. For instrumental music, compare themes and transformations within the form.</li><li>Explain why those details matter. Locate claims within the actual excerpt; do not list features you cannot hear.</li></ol><p>Exposition presents principal material; development transforms it; recapitulation returns it in the home-key framework. The Classical Music 4 timestamps refer to LSO / Haitink, not this alternative Beethoven performance.</p><label className="short" htmlFor="exam-response">Practice a 200–225-word response<small>Choose an excerpt, replay it, and write an argument supported by detail.</small></label><textarea id="exam-response" value={draft} maxLength={8000} onChange={e=>setDraft(e.target.value)}/><p role="status">{words} words · {words>=200&&words<=225?'Within the exam range':words<200?`${200-words} more to reach 200`:`${words-225} above 225`}</p><p>Practice timer: {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')} {remaining===0?'— time to review':''}</p><div className="player-buttons"><button onClick={toggleTimer}>{running?'Pause timer':'Start / resume 20 minutes'}</button><button onClick={()=>saveTimer(1200,null)}>Reset timer</button></div><h3>Self-review checklist</h3><ul><li>Correct identity, period and genre, with no invented cadenza author or formal timestamp.</li><li>Several specific musical observations, expressed with precise terms.</li><li>Evidence and interpretation connected in complete sentences.</li><li>Claims fit this excerpt rather than only the piece’s general reputation.</li></ul><p className="backend">This is a study rubric, not the instructor’s unpublished marking scheme. AI grading is not connected. Your draft stays in browser storage.</p></article></>}

type Progress = Record<string,{choice?:number;answer?:string;reviewed?:boolean}>;
const KEY='music-study-v1';
let memory='{}';let saveError=false;
function persist(next:Progress){memory=JSON.stringify(next);try{localStorage.setItem(KEY,memory);saveError=false;}catch{saveError=true;}window.dispatchEvent(new Event('music-progress'));}
function snapshot(){try{return localStorage.getItem(KEY)||memory;}catch{return memory;}}
function subscribe(notify:()=>void){window.addEventListener('storage',notify);window.addEventListener('music-progress',notify);return ()=>{window.removeEventListener('storage',notify);window.removeEventListener('music-progress',notify);};}
export default function Study(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator))return;
  let stopped=false;
  const cacheAssets=(worker:ServiceWorker|null)=>{if(stopped||!worker)return;const urls=Array.from(document.querySelectorAll<HTMLScriptElement|HTMLLinkElement>('script[src],link[rel="stylesheet"]')).map(el=>el instanceof HTMLScriptElement?el.src:el.href);worker.postMessage({type:'CACHE_PUBLIC_ASSETS',urls});};
  navigator.serviceWorker.register('/music-offline.js',{scope:'/music'}).then(async()=>{const registration=await navigator.serviceWorker.ready;cacheAssets(registration.active);}).catch(()=>{});
  const changed=()=>cacheAssets(navigator.serviceWorker.controller);navigator.serviceWorker.addEventListener('controllerchange',changed);return()=>{stopped=true;navigator.serviceWorker.removeEventListener('controllerchange',changed);};
 },[]);
 const [active,setActive]=useState(0); const [tab,setTab]=useState('vocabulary'); const [show,setShow]=useState(false);
 const saved=useSyncExternalStore(subscribe,snapshot,()=> '{}');
 let progress:Progress={}; try{const parsed=JSON.parse(saved);if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))progress=parsed;}catch{}
 const setProgress=(fn:(p:Progress)=>Progress)=>persist(fn(progress));

 const t=terms[active];const p=progress[t.name]||{}; const update=(patch:Progress[string])=>setProgress(prev=>({...prev,[t.name]:{...prev[t.name],...patch}})); const reviewed=terms.filter(t=>progress[t.name]?.reviewed).length; const correct=terms.filter(t=>progress[t.name]?.choice===t.answer).length;
 return <main className="music"><style>{".music{--ink:#202920;--paper:#f3f0e6;--green:#286043;color:var(--ink);background:var(--paper);font-family:Georgia,serif;min-height:100vh;padding:28px clamp(18px,5vw,80px);box-sizing:border-box}.music *{box-sizing:border-box}.music header{display:flex;justify-content:space-between;gap:20px;font:14px Verdana,sans-serif;border-bottom:1px solid #a6ada0;padding-bottom:24px}.music a{color:var(--green)}.music .hero{display:grid;grid-template-columns:1.1fr 1fr;gap:40px;padding:56px 0}.music .eyebrow{font:11px Verdana,sans-serif;letter-spacing:.18em}.music h1{font-size:clamp(52px,8vw,110px);font-weight:400;line-height:.96;margin:20px 0}.music h1 em{color:var(--green)}.music .hero>.eyebrow{grid-column:1/-1;margin:0}.music .hero>div{align-self:center;max-width:480px;font-size:19px;line-height:1.6}.music .notice{padding:18px;border-left:3px solid #a46227;background:#ece2cc;font:14px/1.6 Verdana,sans-serif}.music nav{display:flex;border-bottom:1px solid #a6ada0;gap:12px}.music button{cursor:pointer;border:1px solid #9ea895;background:transparent;color:var(--ink);padding:14px 18px;min-height:46px;font:13px Verdana,sans-serif}.music button:hover{background:#e2e8dc}.music button:focus-visible,.music a:focus-visible,.music input:focus-visible,.music textarea:focus-visible{outline:3px solid #b96920;outline-offset:4px}.music nav button{border:0;border-bottom:3px solid transparent}.music nav button[aria-current]{border-bottom-color:var(--green);color:var(--green)}.music .progress{display:flex;flex-direction:column;gap:12px;padding:24px 0;font:12px Verdana,sans-serif}.music progress{width:100%;height:6px;accent-color:var(--green)}.music .workspace{display:grid;grid-template-columns:230px 1fr;gap:40px}.music aside{display:flex;flex-direction:column;gap:8px}.music aside button{text-align:left;border:0;border-bottom:1px solid #ccd0c4}.music aside span{margin-right:20px;color:#677464}.music aside button[aria-pressed=true]{background:var(--green);color:white}.music aside button[aria-pressed=true] span{color:white}.music article{padding:32px;background:#fffdf6;border:1px solid #d2d6ca;max-width:900px}.music h2{font-size:clamp(32px,4vw,56px);font-weight:400;margin:18px 0}.music .definition{font-size:24px;line-height:1.5}.music .cue{font-size:18px;line-height:1.6;color:#54664d}.music fieldset{border:0;padding:20px 0;margin:0}.music legend{font-size:19px;line-height:1.5}.music fieldset label{display:flex;align-items:center;gap:12px;border-bottom:1px solid #d9dfd1;padding:16px 0;font:14px Verdana,sans-serif;cursor:pointer}.music input{width:18px;height:18px;accent-color:var(--green)}.music .feedback,.music .rubric{background:#e9efdf;padding:18px;font-size:17px;line-height:1.6}.music .short{display:block;font-size:19px;line-height:1.5;margin-top:24px}.music small{display:block;font:12px Verdana,sans-serif;margin-top:8px}.music textarea{width:100%;min-height:115px;border:1px solid #9ea895;background:#fffef9;padding:14px;font:17px/1.6 Georgia,serif;margin:15px 0}.music .primary{background:var(--green);color:white;border:0}.music .backend,.music footer{font:12px/1.7 Verdana,sans-serif;color:#5e665b}.music footer{border-top:1px solid #d9dfd1;margin-top:32px;padding-top:20px}.music .panel{margin:12px auto}.music .panel>p,.music .panel li{line-height:1.75}.music .scope{display:grid;grid-template-columns:110px 1fr;gap:16px;border-top:1px solid #d9dfd1;padding:16px 0;align-items:baseline}.music .scope p{margin:0;line-height:1.6}@media(max-width:680px){.music .hero{grid-template-columns:1fr;gap:12px;padding:30px 0}.music .hero>.eyebrow{grid-column:auto}.music .hero>div{font-size:17px}.music .workspace{grid-template-columns:1fr;gap:20px}.music aside{flex-direction:row;overflow-x:auto}.music aside button{white-space:nowrap}.music article{padding:22px}.music header{font-size:11px}.music nav{gap:0}.music nav button{padding:14px 8px;font-size:11px}.music .scope{grid-template-columns:1fr;gap:8px}}\n.music .listening>label{display:block;font:13px Verdana,sans-serif;margin:24px 0}.music select{padding:12px;margin-left:12px;color:var(--ink);background:#fffdf6;border:1px solid #9ea895}.music .listening aside{max-height:850px;overflow:auto}.music .listening-player{margin:24px 0;padding-bottom:24px;border-bottom:1px solid #d9dfd1}.music .listening-player iframe{width:100%;min-width:200px;min-height:240px;border:0}.music .player-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.music button:disabled{opacity:.45;cursor:not-allowed}.music input[type=range]{display:block;width:100%;margin:14px 0;height:24px}.music .listening-player [role=status]{font:13px/1.6 Verdana,sans-serif}@media(max-width:680px){.music .listening aside{max-height:none;overflow-x:auto}.music .listening-player iframe{min-height:220px}.music .player-buttons button{font-size:11px;padding:12px}.music .listening-player{margin:16px 0}}\n\n.music .panel .scope{display:block}.music .panel .scope h3{font-size:23px;font-weight:400;line-height:1.4;margin:6px 0 14px}.music .panel .scope p{margin:10px 0}\n"}</style><header><Link href="/">← Samarth</Link><span>HUMA 1123 · Section 030</span></header><section className="hero"><p className="eyebrow">THE LISTENING NOTEBOOK</p><h1>Hear it.<br/><em>Name it.</em><br/>Explain it.</h1><div><p>Start with the vocabulary. Learn to connect a musical claim to something you can actually hear.</p><p className="notice">October 15 exam · Five works · Vocabulary, listening drills and response planning.</p><p>Opens October 15, 2:40 p.m. New York; closes October 16, 2:40 p.m. Start a 60-minute attempt within that window. Three excerpts, 200–225 words each.</p></div></section><nav aria-label="Study sections">{['vocabulary','listening','guide','sources'].map(v=><button key={v} aria-current={tab===v?'page':undefined} onClick={()=>setTab(v)}>{v==='vocabulary'?'01 Vocabulary':v==='listening'?'02 Listening':v==='guide'?'03 Exam guide':'04 Sources'}</button>)}</nav><div className="progress"><label htmlFor="review-progress">{reviewed} / {terms.length} vocabulary cards reviewed · {correct} MCQs correct</label><progress id="review-progress" max={terms.length} value={reviewed}/>{saveError&&<p role="status">Browser storage unavailable. Progress will last for this session only.</p>}</div>
 {tab==='vocabulary'&&<section className="workspace"><aside aria-label="Vocabulary">{terms.map((term,i)=><button key={term.name} aria-pressed={active===i} onClick={()=>{setActive(i);setShow(false)}}><span>{String(i+1).padStart(2,'0')}</span>{term.name}{progress[term.name]?.reviewed?' ✓':''}</button>)}</aside><article><p className="eyebrow">{t.supplemental?'COURSE / EXAM VOCABULARY':'SEPTEMBER QUIZ VOCABULARY'} / {String(active+1).padStart(2,'0')}</p><h2>{t.name}</h2><p className="definition">{t.definition}</p><p className="cue">{t.cue}</p><fieldset><legend>{t.question}</legend>{t.options.map((o,i)=><label key={o}><input type="radio" name={t.name} checked={p.choice===i} onChange={()=>update({choice:i})}/>{o}</label>)}</fieldset>{typeof p.choice==='number'&&<p role="status" className="feedback">{p.choice===t.answer?'Correct.':'Revisit the definition.'} {t.definition}</p>}<label className="short" htmlFor="short-answer">{t.prompt}<small>Answer in 1–2 sentences.</small></label><textarea id="short-answer" maxLength={1000} value={p.answer||''} onChange={e=>update({answer:e.target.value})}/><button className="primary" onClick={()=>{setShow(true);update({reviewed:true})}}>Compare with the rubric</button><p className="backend">AI grading is not connected. This button opens a self-review rubric.</p>{show&&<div className="rubric"><h3>Check your explanation</h3><ul>{t.rubric.map(r=><li key={r}>{r}</li>)}</ul><p><strong>Example answer:</strong> {t.model}</p><p>Equivalent clear wording is acceptable. Revise any claim that lacks evidence.</p></div>}<footer>Source: {t.source||source}</footer></article></section>}
 {tab==='listening'&&<Listening/>}
 {tab==='guide'&&<Guide/>}
 {tab==='sources'&&<article className="panel"><p className="eyebrow">SOURCE NOTES</p><h2>The posted guide sets the scope.</h2><p>The primary source is <a href="https://courseworks2.columbia.edu/courses/249492/files/28594169">KENDALL Listening Exam Study Guide Fall 26 SECTION 030.pdf</a>, pages 1–2, checked October 12. The five required works are Monteverdi’s Era l’anima mia, Strozzi’s Lagrime mie, Bach’s Brandenburg Concerto no. 5, Mozart’s Piano Concerto no. 20 and Beethoven’s Symphony no. 5. Only the first movements of the three instrumental works are assigned here.</p><ul><li>Terminology quiz packet: monophony, polyphony, drone, register, melisma, syllabic and strophic.</li><li>Renaissance Music 2, pp. 1–2: Monteverdi, vocal texture and text expression.</li><li>Baroque Music 2, pp. 1–4: Strozzi, lament, continuo and contrasting text setting.</li><li>Baroque Music 3, pp. 1–2: Bach, concertino, ripieno, harpsichord and instrument families.</li><li>Classical Music 1 and Classical Music 4, pp. 1–2: solo concerto, cadenza, Beethoven’s motif and sonata form.</li><li>October 1, 6 and 8 lecture transcripts corroborate listening concepts. They are timestamped drafts awaiting audio review, so the posted guide and handouts take precedence.</li></ul><p>Earlier medieval works, Joseph Bologne and Don Giovanni remain useful class context but are outside this posted five-work exam list. This app does not substitute the whole syllabus for the exam guide.</p><p>Each card identifies its course source. Questions, explanations and study notes are original. Private PDFs, emails, class recordings and full translations are not published.</p><p>Listening uses official performer or label streams. These are alternative performances, so the handout’s exact timings and assigned Mozart cadenza attribution cannot be transferred. Player availability can vary by region; each exercise has an official source link. Playback checks establish streaming and seek behavior, not a human audit of every musical cue.</p><p>Progress and answers stay in this browser. AI grading is not connected; self-review keys remain available offline after the first successful visit. Audio still needs internet.</p><a href="/music-coverage.json">Read the coverage manifest ↗</a><br/><a href="https://courseworks2.columbia.edu/courses/249492">Open CourseWorks ↗</a></article>}
 </main>
}
