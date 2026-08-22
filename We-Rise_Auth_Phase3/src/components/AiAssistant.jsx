import React, { useState, useRef, useEffect } from 'react';
import { HiSparkles } from 'react-icons/hi';

const aiResponses = {
  en: [
    { keywords: ['itch', 'itching', 'itchy', 'rash', 'skin', 'sole', 'feet', 'foot'], response: 'Itching on or deep in the feet can have several causes, including irritated or dry skin, fungal infection, eczema, allergies, or sometimes nerve-related irritation. I cannot diagnose the cause here. Check for a rash, peeling, cracks, swelling, numbness, warmth, or pain. If it keeps returning, is severe, or you have diabetes or numbness, it is worth speaking to a doctor or pharmacist. Seek urgent medical help for major swelling, trouble breathing, rapidly spreading redness, or severe pain.' },
    { keywords: ['relationship', 'love', 'partner', 'boyfriend', 'husband', 'dating'], response: 'A healthy relationship should include respect, honesty, safety, and room for both people to grow. If something is bothering you, tell me what happened and we can think it through together. 💗' },
    { keywords: ['career', 'job', 'work', 'business', 'promotion', 'salary'], response: 'Let us make it practical. Tell me what you are trying to achieve at work or in business, what is blocking you, and what options you already have. I can help you turn it into a next-step plan. ✨' },
    { keywords: ['health', 'wellness', 'fitness', 'exercise', 'diet', 'mental'], response: 'I can help you think through general wellbeing questions, but I am not a doctor and cannot diagnose symptoms. Tell me what you are experiencing, how long it has been happening, and whether anything makes it better or worse.' },
    { keywords: ['friend', 'friendship', 'girlfriend', 'toxic'], response: 'Good friendships should allow honesty, boundaries, and mutual support. Tell me what the other person is doing and how it is affecting you, and we can work through your options.' },
    { keywords: ['money', 'finance', 'saving', 'invest', 'debt', 'budget'], response: 'We can make this concrete. Tell me your goal, roughly what comes in each month, your biggest expenses or debts, and the timeframe you are working with. I can help you build a simple plan. 💰' },
    { keywords: ['anxiety', 'stress', 'overwhelm', 'depression', 'sad', 'lonely'], response: 'That sounds difficult. If you tell me what is happening right now, I can help you break it into smaller next steps. If you feel in immediate danger or might hurt yourself, contact local emergency services or someone you trust right away.' },
    { keywords: ['confidence', 'self-esteem', 'insecurity', 'body', 'beautiful'], response: 'Confidence usually grows from evidence: doing small difficult things, keeping promises to yourself, and building skills. Tell me where you feel least confident and we can choose one practical step to work on.' },
    { keywords: ['purpose', 'goal', 'dream', 'passion', 'future'], response: 'Start with the outcome you want, then work backward. Tell me the dream or goal and your current situation, and I will help you turn it into a realistic first set of steps. 🌟' },
  ],
  af: [
    { keywords: ['jeuk', 'jeukerig', 'uitslag', 'vel', 'voet', 'voete', 'sool'], response: 'Jeuk op of diep in die voete kan verskeie oorsake hê, soos droë of geïrriteerde vel, ’n swaminfeksie, ekseem, allergieë of soms senuwee-irritasie. Ek kan nie die oorsaak hier diagnoseer nie. Kyk vir uitslag, afskilfering, krake, swelling, gevoelloosheid, hitte of pyn. As dit aanhou terugkom, ernstig is, of jy diabetes of gevoelloosheid het, praat met ’n dokter of apteker. Kry dringend mediese hulp met groot swelling, asemhalingsprobleme, vinnig verspreidende rooiheid of erge pyn.' },
    { keywords: ['verhouding', 'liefde', 'man', 'kêrel', 'dating'], response: '’n Gesonde verhouding behoort respek, eerlikheid, veiligheid en ruimte vir albei mense om te groei in te sluit. Vertel my wat gebeur het en ons kan dit saam deurwerk. 💗' },
    { keywords: ['loopbaan', 'werk', 'besigheid', 'promosie', 'salaris'], response: 'Kom ons maak dit prakties. Vertel my wat jy by die werk of in besigheid wil bereik, wat jou keer, en watter opsies jy reeds het. Ek kan jou help om ’n volgende-stap-plan te maak. ✨' },
    { keywords: ['gesondheid', 'fiksheid', 'oefening', 'dieet', 'mentaal', 'welstand'], response: 'Ek kan help met algemene welstandsvrae, maar ek is nie ’n dokter nie en kan nie simptome diagnoseer nie. Vertel my wat jy ervaar, hoe lank dit al gebeur en of enigiets dit beter of erger maak.' },
    { keywords: ['vriend', 'vriendskap', 'toksies'], response: 'Goeie vriendskappe behoort eerlikheid, grense en wedersydse ondersteuning toe te laat. Vertel my wat die ander persoon doen en hoe dit jou raak, dan kan ons jou opsies deurwerk.' },
    { keywords: ['geld', 'finansies', 'spaar', 'belê', 'skuld', 'begroting'], response: 'Kom ons maak dit konkreet. Vertel my jou doel, ongeveer wat elke maand inkom, jou grootste uitgawes of skuld, en jou tydraamwerk. Ek kan jou help om ’n eenvoudige plan te bou. 💰' },
    { keywords: ['angs', 'stres', 'oorweldig', 'depressie', 'hartseer', 'eensaam'], response: 'Dit klink moeilik. Vertel my wat nou gebeur en ek kan jou help om dit in kleiner volgende stappe op te deel. As jy in onmiddellike gevaar is of dalk jouself kan seermaak, kontak plaaslike nooddienste of iemand wat jy vertrou onmiddellik.' },
    { keywords: ['selfvertroue', 'selfbeeld', 'onsekerheid', 'lyf', 'mooi'], response: 'Selfvertroue groei gewoonlik uit bewyse: klein moeilike dinge doen, beloftes aan jouself nakom en vaardighede bou. Vertel my waar jy die minste selfvertroue het en ons kan een praktiese stap kies.' },
    { keywords: ['doelwit', 'droom', 'passie', 'toekoms'], response: 'Begin by die uitkoms wat jy wil hê en werk dan terug. Vertel my die droom of doelwit en jou huidige situasie, dan help ek jou om dit in realistiese eerste stappe te verander. 🌟' },
  ]
};

function getAIResponse(message, lang) {
  const lower = message.toLowerCase();
  const responses = aiResponses[lang] || aiResponses.en;
  for (const item of responses) {
    if (item.keywords.some(kw => lower.includes(kw))) return item.response;
  }
  return lang === 'af'
    ? 'Ek luister. Gee my ’n bietjie meer besonderhede oor wat gebeur, wat jy probeer bereik, en wat jy reeds probeer het. Dan kan ek jou ’n meer nuttige antwoord gee. 💗'
    : 'I am listening. Give me a little more detail about what is happening, what you are trying to achieve, and what you have already tried. Then I can give you a more useful answer. 💗';
}

export default function AiAssistant({ t, lang, userName }) {
  const welcome = userName
    ? (lang === 'af' ? `Hallo ${userName}! Ek is We-Rise AI. Hoe kan ek jou vandag help?` : `Hi ${userName}! I am We-Rise AI. How can I help you today?`)
    : t.aiWelcome;

  const [messages, setMessages] = useState([{ role: 'ai', content: welcome }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    setMessages([{ role: 'ai', content: welcome }]);
  }, [lang, userName]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content: getAIResponse(userMsg, lang) }]);
      setIsTyping(false);
    }, 650);
  };

  return (
    <div className="fade-in">
      <h2 className="section-title">{t.aiAssistant}</h2>
      <p className="section-subtitle">{lang === 'en' ? 'Practical support from We-Rise AI.' : 'Praktiese ondersteuning van We-Rise AI.'}</p>

      <div className="chat-container">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            <div className={`chat-avatar ${msg.role}`}>{msg.role === 'ai' ? 'W' : '👤'}</div>
            <div className="chat-bubble">{msg.content}</div>
          </div>
        ))}
        {isTyping && (
          <div className="chat-message ai">
            <div className="chat-avatar ai">W</div>
            <div className="chat-bubble"><div className="typing-indicator"><span></span><span></span><span></span></div></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t.askQuestion}
          disabled={isTyping}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!input.trim() || isTyping} aria-label={t.send}>
          <HiSparkles />
        </button>
      </div>
    </div>
  );
}
