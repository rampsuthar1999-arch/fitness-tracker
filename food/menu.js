/* Family weekly menu — vegetarian, no added sugar, low-GI (pre-diabetes friendly), high protein.
   Everyone eats the same dishes; only portions differ.
   Portions: [small, medium, large]  ≈ 1350 / 1950 / 2800 kcal days.
   Day index follows JavaScript: 0 = Sunday … 6 = Saturday. */
const FAMILY_MENU = {
  1: { // Monday
    breakfast:[['moong-dal-chilla',[2,2,3]],['curd-dahi',[1,1,1]],['guava',[1,1,1]]],
    lunch:[['jowar-roti',[1,2,2]],['dal-palak',[1,1,1.5]],['bhindi-sabzi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[1,1,1]]],
    snacks:[['roasted-chana',[0.5,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['whey-protein-in-water',[0,0,1]],['banana',[0,0,1]]],
    dinner:[['roti-chapati-no-ghee',[1,1,3]],['paneer-bhurji',[0.5,1,1]],['lauki-tori-tinda-sabzi',[1,1,1]]] },
  2: { // Tuesday
    breakfast:[['vegetable-daliya',[1,1,1.5]],['greek-yogurt-hung-curd',[0,1,2]],['apple',[1,1,1]]],
    lunch:[['brown-rice-cooked',[0.5,1,1.5]],['rajma-curry',[1,1,1.5]],['gobi-cabbage-sabzi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[1,1,1]]],
    snacks:[['sprouts-chaat',[1,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['bajra-roti',[1,1,2]],['moong-dal',[1,1,1]],['mixed-veg-sabzi',[1,1,1]],['paneer-plain',[0,0.5,1]]] },
  3: { // Wednesday
    breakfast:[['idli',[2,3,4]],['sambar',[1,1,1.5]],['papaya',[1,1,1]],['paneer-plain',[0,0,1]]],
    lunch:[['roti-chapati-no-ghee',[1,2,3]],['chole',[1,1,1]],['palak-saag',[1,1,1]],['veg-raita',[1,1,1]]],
    snacks:[['roasted-makhana',[1,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['walnuts',[0,1,2]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['multigrain-roti',[1,1,2]],['tofu-bhurji',[1,1,1.5]],['tori-turai-sabzi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[0,1,1]]] },
  4: { // Thursday
    breakfast:[['besan-chilla',[1,2,3]],['curd-dahi',[1,1,1]],['orange-mosambi',[1,1,1]]],
    lunch:[['bajra-roti',[1,2,2]],['masoor-dal',[1,1,1.5]],['gajar-matar',[1,1,1]],['kachumber-cucumber',[1,1,1]],['buttermilk-chaas',[1,1,1]]],
    snacks:[['peanuts-roasted',[0.5,0.5,1]],['tea-with-milk-no-sugar',[1,1,1]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['khichdi',[1,1,1.5]],['kadhi',[0,1,1]],['baingan-bharta',[1,1,1]],['greek-yogurt-hung-curd',[0,0,1]]] },
  5: { // Friday
    breakfast:[['methi-thepla',[1,2,3]],['curd-dahi',[1,1,1.5]],['guava',[1,1,1]]],
    lunch:[['roti-chapati-no-ghee',[1,2,3]],['kala-chana-curry',[1,1,1]],['french-beans-sabzi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[1,1,1]]],
    snacks:[['chana-chaat-boiled-kabuli-chana',[0.5,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['jowar-roti',[1,1,2]],['palak-paneer',[1,1,1.5]],['shimla-mirch-capsicum-sabzi',[1,1,1]]] },
  6: { // Saturday
    breakfast:[['masala-oats',[1,1,1.5]],['greek-yogurt-hung-curd',[0,1,2]],['pear',[1,1,1]]],
    lunch:[['roti-chapati-no-ghee',[1,2,3]],['soya-chunks-curry',[1,1,1]],['karela-sabzi',[1,1,1]],['veg-raita',[1,1,1]]],
    snacks:[['roasted-chana',[0.5,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['almonds',[1,1,2]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['multigrain-roti',[1,1,2]],['dal-tadka-fry',[1,1,1]],['patta-gobhi-cabbage-sabzi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[0,1,1]]] },
  0: { // Sunday
    breakfast:[['pesarattu-moong-dosa',[1,2,3]],['green-chutney',[1,1,1]],['papaya',[1,1,1]],['curd-dahi',[0,0,1]]],
    lunch:[['brown-rice-cooked',[0.5,1,1.5]],['lobia-black-eyed-beans-curry',[1,1,1.5]],['beetroot-sabzi',[1,1,1]],['curd-dahi',[1,1,1]],['green-salad-cucumber-tomato-onion-carrot',[1,1,1]]],
    snacks:[['moong-sprouts-salad',[1,1,1]],['tea-with-milk-no-sugar',[1,1,1]],['whey-protein-in-water',[0,0,1]]],
    dinner:[['vegetable-soup',[1,1,1]],['paneer-tikka-grilled',[0.5,1,1]],['boiled-steamed-vegetables',[1,1,1]],['roti-chapati-no-ghee',[1,1,2]]] },
};
const MENU_DAYS = [1,2,3,4,5,6,0];

/* Added to every day of the week (protein & calcium top-ups). */
const MENU_DAILY_EXTRAS = {
  snacks:[['greek-yogurt-hung-curd',[1,1,0]],['milk-toned-no-sugar',[0,1,1]]],
  lunch:[['paneer-plain',[0,0,1]]],
  dinner:[['roti-chapati-no-ghee',[0,1,1]]],
};
