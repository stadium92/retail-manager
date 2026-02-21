# Original Client Brief — Multi-Price Tiers, Batch Tracking & Supplier Integration

> **Date:** 2026-02-21  
> **Source:** Client verbal brief (raw, unedited)  
> **Status:** Processed → See indexed files below

---

## Related Files

| File | Purpose |
|------|---------|
| **[`plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md`](../plans/PRD-005-Multi-Price-Tiers-And-Batch-Tracking.md)** | Structured PRD derived from this brief |
| **[`docs/PROMPT-005-Multi-Price-Batch-Implementation.md`](PROMPT-005-Multi-Price-Batch-Implementation.md)** | Agent-ready implementation prompt (Gemini 3 Pro, 1M ctx) |
| **This file** | Original unedited client requirements |

---

## Client Brief (Verbatim)

### Adding more price logics to differentiate the prices between the stores:

I need more price logics, different from the "Prix de vente" which is the base price, I want more price logics like the 2nd price, 3rd and 4th, which may help since you may stores in different locations thus different prices, and from the selling dashboard (under the worker side for example when selling an item , I should be able to set the price to match another price batch if I want ( please when you read bellow you will understand more about the batch we are talking about) should be able to set the prices anyhow you want also. But specially for the 2nd and other selling price I should be able to assign them to a store per default in the "file" module when creating new product files, there should be an option where i can set the default price (kind of an dropdown of each prices). Please this feature should be under the "PRICE" section of the "add new article" widget, it should fit under it please. And remember we have this feature in both the master and the worker side of the project so please be careful about that (this module was supposed to be written just once so that they are both used by the worker and the master side of the code please can you check it is done correctly?)

### Question and brainstorming (please here bellow, act like an team Q/A tester with an team of clients trying to sort this out):

At which price are we buying the product? This one is important when buying or adding new products (please need you to think deeply and link this logic to the one I mentioned above), because the source of the product may vary on how/where you are buying it, are we buying it at wholesale price? (Prix en gros) or are we buying it from another store who've got it at another price which may be different from your own resell price (prix revente or resell price, it is price you are willing to give receive from another store who want to buy your products and you are actually supposed to give the product at a discount which should be different and lower than you "Prix de vent", this price is meant in such a way so you won't make any loss on your whole purchases ), or are we buying it at an different price? (An price that is different from the wholesale price, and maybe you are getting it from store you is willing to give it to you also at an discount) This is really important, we should keep track of the products batch values ( by some batch I meant some of the batch you are buying may not be from an whole sale source or you've got it another different price ) , we should be able to differentiate the product batches per price ( so we should normally keep track of the difference in margin of each batch this is really important in order to keep track of each incoming and at which price we've bought it and then also the price we are selling it. ).

### Frontend implementation:

Also we should add this as an feature, we should able to class the batches, by classing I meant for example in the inventory, we should be able to see the prices differences in the batches, we should see them classed by batches and groups we have been buying it from. There should be an dropdown available for each product file which reveals its batch (the batch should be the price), the price and the other informations available in the table for that batch (please it should be nice to add the receiving date of the product so we know when we bought it.). This suggestion is an frontend interaction suggestion and maybe you know a better place to place it but I suggest using the inventory module side of the master dashboard, also under the submodules of the "Stock" module under the worker dashboard (relevant places like stock inventory, stock sheets, stock listings )

Due to the fact that we can be buying from different suppliers (please do you recall the "prix de revente" and the "resell price" I was discussing about? Then yeah we are implementing some fixes to those modules to make the whole feature a whole please), so we should add an subsequent feature to the supplier side of the project (also please there should be an balance confirmation button for supplier module (a button that confirms that we have paid the supplier), because in here we just have the "Due Balance" and we keep owning him but there is no button to pay him), an price feature to set when buying a problem from the supplier , on the "add supplier" widget please , because we can just set its number and names, not the price, so this should be added to the batch analysis we were talking about, so we can just class the products we were getting from the any other supplier.

### Note:

Please we should think on this features and implement them through the codebase please, so we should first brainstorm on these, read through the codebase and understand the already implemented code logics before making surgical refactors to code in order to implement them. And please we should take account of the MVP metrics calculations in the codebase so that we won't forget anything, like for example the calculations logics should smoothly add up, and effective reflect in the valuations features please. Please also about the table creations we should be really mindful on how it will affect the database. And also PLEASE PLEASE you should not forget about the pyramidal authorization scheme of the backend, like for example the assigning authorization go the app, you should be on each implementation we are adding and check it pyramidal authorizations, and also for example an worker assigned in one store can not access the informations in other stores.
