# html-list-extraction
This project extracts all lists found from an input URL. At the moment, it is mostly just a place for me to put ideas for the project.


## Ideas
1. Take in a url as input and output all lists found in that webpage.
    * Include some metric to measure how likely each item belongs in the list

    * Before calculating feature of indivdiual item, get list of all children nodes + css class names + calculated styles
    
    * Features: height of item, width of item, max depth of item, does node have child node with css + style (one feature per possible child), does node contain entity (date, time, location), does node contain entity with same style?

    * Entity recognizer/gazeteer/nlp tools:
        1. Custom List
        1. [Who's on First](https://whosonfirst.mapzen.com/) 
        1. [DBpedia](http://wiki.dbpedia.org/)
        1. [Yelp dataset](https://www.yelp.com/dataset_challenge)
        1. [Geonames](http://www.geonames.org/)
        1. [https://nominatim.openstreetmap.org/](https://nominatim.openstreetmap.org/)
        1. [https://openaddresses.io/](https://openaddresses.io/)
        1. [spaCy](https://github.com/explosion/spaCy) 
    
    * Use [chromeless](https://github.com/graphcool/chromeless) to render webpage and gather features from page and return features to calling code
    
    * Use [sci-kit learn](https://github.com/scikit-learn/scikit-learn) to perform clustering of page

    *  Pseudocode:
        ```
        for each node n:
            list = all children of n
            features = all features
        ```

2. After finding lists in a page, look to see if a date, time, and location.
    * Date/Time is most likely within list item.
    * Location can be in list item or the page itself (where all events in a list are for the same location)
    * If both date/time and location are identified, look for title of event.  
    * Title is likely a short string (not a paragraph of text).

## Similar Projects
### [https://github.com/scrapinghub/aile](https://github.com/scrapinghub/aile)
